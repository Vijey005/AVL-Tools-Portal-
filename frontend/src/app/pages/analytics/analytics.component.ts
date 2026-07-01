import { Component, OnInit, OnDestroy } from '@angular/core';

import { CommonModule } from '@angular/common';

import { Router, RouterModule } from '@angular/router';

import { ApiService } from '../../services/api.service';

import { Subscription, interval } from 'rxjs';



interface DonutSegment {

  tool_type: string;

  label: string;

  count: number;

  pct: number;

  color: string;

  dashArray: string;

  dashOffset: number;

}



interface KpiTrend {

  delta_pct: number;

  direction: 'up' | 'down' | 'neutral';

}



interface ChartPoint {

  date: string;

  count: number;

  label?: string;

}



interface ChartCoord {

  x: number;

  y: number;

}



const TOOL_COLORS: Record<string, string> = {

  lmm: '#005A99',

  organigram: '#00A4C7',

  dashboard: '#028550',

};



const DONUT_R = 62;

const DONUT_C = 2 * Math.PI * DONUT_R;

const CHART_W = 480;

const CHART_H = 148;



type TimeRange = '7d' | '30d';

type ViewScope = 'all' | 'workspace' | 'organization';



@Component({

  selector: 'app-analytics',

  standalone: true,

  imports: [CommonModule, RouterModule],

  templateUrl: './analytics.component.html',

  styleUrls: ['./analytics.component.css']

})

export class AnalyticsComponent implements OnInit, OnDestroy {

  data: any = null;

  loading = true;

  errorMsg = '';



  timeRange: TimeRange = '7d';

  viewScope: ViewScope = 'all';

  hoveredBar: { chart: string; index: number } | null = null;

  activeDonutSegment: string | null = null;

  showAllRecent = false;

  showAllStale = false;



  readonly donutR = DONUT_R;

  readonly chartW = CHART_W;

  readonly chartH = CHART_H;

  private pollingSub?: Subscription;



  constructor(private api: ApiService, private router: Router) {}



  ngOnInit() {

    this.loadDashboard();

    this.pollingSub = interval(30000).subscribe(() => this.pollDashboard());

  }



  ngOnDestroy() {

    this.pollingSub?.unsubscribe();

  }



  loadDashboard() {

    this.loading = true;

    this.errorMsg = '';

    this.api.getAnalyticsDashboard().subscribe({

      next: (data) => { this.data = data; this.loading = false; },

      error: (err) => {

        this.loading = false;

        this.errorMsg = err.error?.detail || 'Unable to load analytics.';

      }

    });

  }



  pollDashboard() {

    this.api.getAnalyticsDashboard().subscribe({

      next: (data) => { this.data = data; },

      error: () => {}

    });

  }



  setTimeRange(range: TimeRange) { this.timeRange = range; this.hoveredBar = null; }

  setViewScope(scope: ViewScope) { this.viewScope = scope; }



  get showWorkspace(): boolean {

    return this.viewScope === 'all' || this.viewScope === 'workspace';

  }



  get showOrganization(): boolean {

    return this.viewScope === 'all' || this.viewScope === 'organization';

  }



  get personalActivity(): ChartPoint[] {

    if (!this.data?.personal) return [];

    return this.timeRange === '7d' ? this.data.personal.activity_7d : this.data.personal.activity_30d;

  }



  get orgActivity(): ChartPoint[] {

    if (!this.data?.organization) return [];

    return this.timeRange === '7d' ? this.data.organization.activity_7d : this.data.organization.activity_30d;

  }



  private get staleIdSet(): Set<number> {

    return new Set((this.data?.personal?.stale_project_list ?? []).map((p: any) => p.id));

  }



  get recentPool(): any[] {

    const staleIds = this.staleIdSet;

    return (this.data?.personal?.recent_projects ?? []).filter((p: any) => !staleIds.has(p.id));

  }



  get displayRecent(): any[] {

    const limit = this.showAllRecent ? 8 : 4;

    return this.recentPool.slice(0, limit);

  }



  get hasMoreRecent(): boolean {

    return this.recentPool.length > 4;

  }



  get displayStale(): any[] {

    const limit = this.showAllStale ? 6 : 3;

    return (this.data?.personal?.stale_project_list ?? []).slice(0, limit);

  }



  get totalStaleCount(): number {

    return this.data?.personal?.stale_projects ?? this.data?.personal?.stale_project_list?.length ?? 0;

  }



  get hasMoreStale(): boolean {

    return (this.data?.personal?.stale_project_list?.length ?? 0) > 3;

  }



  toggleRecentExpanded() { this.showAllRecent = !this.showAllRecent; }

  toggleStaleExpanded() { this.showAllStale = !this.showAllStale; }



  maxActivity(series: ChartPoint[]): number {

    if (!series.length) return 1;

    return Math.max(1, ...series.map(d => d.count));

  }



  get personalActivityTotal(): number {

    return this.personalActivity.reduce((s, d) => s + d.count, 0);

  }



  get orgActivityTotal(): number {

    return this.orgActivity.reduce((s, d) => s + d.count, 0);

  }



  get personalActivityAvg(): number {

    if (!this.personalActivity.length) return 0;

    return Math.round(this.personalActivityTotal / this.personalActivity.length * 10) / 10;

  }



  get orgActivityAvg(): number {

    if (!this.orgActivity.length) return 0;

    return Math.round(this.orgActivityTotal / this.orgActivity.length * 10) / 10;

  }



  barHeight(count: number, max: number): string {

    const pct = Math.max(count > 0 ? 8 : 3, Math.round((count / max) * 100));

    return `${pct}%`;

  }



  pointLabel(day: ChartPoint): string {

    return day.label || this.formatShortDay(day.date);

  }



  formatShortDay(dateStr: string): string {

    const d = new Date(dateStr + 'T12:00:00Z');

    return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });

  }



  onBarEnter(chart: string, index: number) {

    this.hoveredBar = { chart, index };

  }



  onBarLeave() {

    this.hoveredBar = null;

  }



  isBarHovered(chart: string, index: number): boolean {

    return this.hoveredBar?.chart === chart && this.hoveredBar?.index === index;

  }



  getTooltipLabel(chart: string): string {

    if (!this.hoveredBar || this.hoveredBar.chart !== chart) return '';

    const series = chart === 'personal' ? this.personalActivity : this.orgActivity;

    const pt = series[this.hoveredBar.index];

    return pt ? this.pointLabel(pt) : '';

  }



  getTooltipCount(chart: string): number {

    if (!this.hoveredBar || this.hoveredBar.chart !== chart) return 0;

    const series = chart === 'personal' ? this.personalActivity : this.orgActivity;

    return series[this.hoveredBar.index]?.count ?? 0;

  }



  getTooltipX(chart: string): string {

    if (!this.hoveredBar || this.hoveredBar.chart !== chart) return '50%';

    const series = chart === 'personal' ? this.personalActivity : this.orgActivity;

    const step = CHART_W / (series.length - 1 || 1);

    const x = this.hoveredBar.index * step;

    return `${(x / CHART_W) * 100}%`;

  }



  buildDonut(breakdown: any[]): DonutSegment[] {

    const total = breakdown.reduce((s, t) => s + t.count, 0);

    if (!total) return [];

    let offset = 0;

    return breakdown.filter(t => t.count > 0).map(t => {

      const pct = t.count / total;

      const length = pct * DONUT_C;

      const seg: DonutSegment = {

        tool_type: t.tool_type,

        label: t.label,

        count: t.count,

        pct: Math.round(pct * 100),

        color: TOOL_COLORS[t.tool_type] || '#64748b',

        dashArray: `${length} ${DONUT_C - length}`,

        dashOffset: -offset,

      };

      offset += length;

      return seg;

    });

  }



  get personalDonut(): DonutSegment[] {

    return this.buildDonut(this.data?.personal?.tool_breakdown ?? []);

  }



  get orgDonut(): DonutSegment[] {

    return this.buildDonut(this.data?.organization?.tool_breakdown ?? []);

  }



  get personalDonutTotal(): number {

    return this.data?.personal?.tool_breakdown?.reduce((s: number, t: any) => s + t.count, 0) ?? 0;

  }



  get orgDonutTotal(): number {

    return this.data?.organization?.tool_breakdown?.reduce((s: number, t: any) => s + t.count, 0) ?? 0;

  }



  private chartCoords(activity: ChartPoint[], width: number, height: number): ChartCoord[] {

    if (!activity?.length) return [];

    const max = this.maxActivity(activity);

    const pad = 12;

    const step = width / (activity.length - 1 || 1);

    return activity.map((d, i) => ({

      x: i * step,

      y: height - pad - (d.count / max) * (height - pad * 2),

    }));

  }



  buildAreaPath(activity: ChartPoint[], width: number, height: number): string {

    const pts = this.chartCoords(activity, width, height);

    if (!pts.length) return '';

    const line = this.buildSmoothLinePath(activity, width, height);

    return `${line} L${width},${height} L0,${height} Z`;

  }



  buildSmoothLinePath(activity: ChartPoint[], width: number, height: number): string {

    const pts = this.chartCoords(activity, width, height);

    if (!pts.length) return '';

    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;



    let d = `M${pts[0].x},${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {

      const p0 = pts[Math.max(i - 1, 0)];

      const p1 = pts[i];

      const p2 = pts[i + 1];

      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;

      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;

      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;

    }

    return d;

  }



  buildDots(activity: ChartPoint[], width: number, height: number): { x: number; y: number; count: number }[] {

    const pts = this.chartCoords(activity, width, height);

    return pts.map((p, i) => ({ ...p, count: activity[i].count }));

  }



  gridLineY(index: number, total: number, height: number): number {

    const pad = 12;

    const usable = height - pad * 2;

    return pad + (usable / (total - 1)) * index;

  }



  gridLineLabel(index: number, total: number, max: number): string {

    const val = Math.round(max - (max / (total - 1)) * index);

    return val > 0 ? String(val) : '';

  }



  contributorBarWidth(count: number): string {

    const max = this.data?.organization?.top_contributors?.[0]?.project_count || 1;

    return `${Math.max(8, Math.round((count / max) * 100))}%`;

  }



  get topContributorsDisplay(): any[] {

    return (this.data?.organization?.top_contributors ?? []).slice(0, 3);

  }



  getTrend(scope: 'personal' | 'organization', key: string): KpiTrend | null {

    return this.data?.[scope]?.trends?.[key] ?? null;

  }



  trendLabel(key: string): string {

    const labels: Record<string, string> = {

      owned: 'vs prior week',

      active: 'vs prior week',

      shared_out: 'vs prior week',

      created: 'vs prior week',

      updated: 'vs prior week',

    };

    return labels[key] ?? '';

  }



  openProject(project: any) {

    const routes: Record<string, string> = {

      lmm: '/tools/lmm',

      organigram: '/tools/organigram',

      dashboard: '/tools/dashboard',

    };

    const base = routes[project.tool_type];

    if (base) this.router.navigate([base, project.id]);

  }



  get hasAdminAlerts(): boolean {

    if (!this.data?.is_admin) return false;

    return (this.data.operations?.pending_password_resets || 0) > 0

      || (this.data.operations?.pending_user_approvals || 0) > 0;

  }



  getInitials(name: string): string {

    const parts = name.trim().split(/\s+/);

    if (!parts[0]) return '?';

    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();

  }



  toggleDonutSegment(toolType: string) {

    this.activeDonutSegment = this.activeDonutSegment === toolType ? null : toolType;

  }

}


