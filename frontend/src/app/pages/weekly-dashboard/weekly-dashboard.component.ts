import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

interface DashboardRow {
  id: string;
  item: string;
  weight: number;
  comments: string;
  status: number;
  traj: number;
  next: string;
}

interface DashboardSnapshot {
  week: string;
  savedAt: string;
  globalTrajMode: 'auto' | 'manual';
  globalTrajManual: number;
  rows: DashboardRow[];
}

interface DashboardState {
  _type: string;
  _version: number;
  meta: { title: string; subtitle: string; author: string };
  activeWeek: string;
  snapshots: DashboardSnapshot[];
}

@Component({
  selector: 'app-weekly-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weekly-dashboard.component.html',
  styleUrl: './weekly-dashboard.component.css'
})
export class WeeklyDashboardComponent implements OnInit, OnDestroy {
  fileId!: number;
  fileName: string = '';
  state!: DashboardState;
  loading: boolean = true;
  saving: boolean = false;
  
  private saveSubject = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
    this.api.getFile(this.fileId).subscribe({
      next: (file) => {
        this.fileName = file.name;
        this.parsePayload(file.json_payload);
        this.loading = false;
      },
      error: (err) => console.error(err)
    });

    // Auto-save debouncer
    this.saveSubject.pipe(debounceTime(1500)).subscribe(() => {
      this.performSave();
    });
  }

  ngOnDestroy() {
    this.saveSubject.complete();
  }

  parsePayload(payloadStr: string) {
    try {
      this.state = JSON.parse(payloadStr);
      if (!this.state.snapshots) this.initEmptyState();
    } catch {
      this.initEmptyState();
    }
  }

  initEmptyState() {
    this.state = {
      _type: 'AVL_WeeklyDashboard',
      _version: 3,
      meta: { title: 'Weekly Dashboard', subtitle: 'Macro project indicators', author: '' },
      activeWeek: this.getCurrentWeek(),
      snapshots: [{
        week: this.getCurrentWeek(),
        savedAt: new Date().toISOString(),
        globalTrajMode: 'auto',
        globalTrajManual: 1,
        rows: []
      }]
    };
    this.triggerSave();
  }

  getCurrentWeek() {
    const d = new Date();
    const startDate = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil(days / 7);
    return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  get activeSnapshot(): DashboardSnapshot {
    return this.state.snapshots.find(s => s.week === this.state.activeWeek) || this.state.snapshots[0];
  }

  triggerSave() {
    this.saveSubject.next();
  }

  performSave() {
    this.saving = true;
    const payload = JSON.stringify(this.state);
    this.api.updateFile(this.fileId, { name: this.fileName, json_payload: payload }).subscribe({
      next: () => this.saving = false,
      error: () => this.saving = false
    });
  }

  // Row Actions
  addRow() {
    this.activeSnapshot.rows.push({
      id: Math.random().toString(36).substring(2, 9),
      item: 'New item',
      weight: 1,
      comments: '',
      status: -1,
      traj: -1,
      next: ''
    });
    this.triggerSave();
  }

  deleteRow(id: string) {
    if (confirm('Delete this item?')) {
      this.activeSnapshot.rows = this.activeSnapshot.rows.filter(r => r.id !== id);
      this.triggerSave();
    }
  }

  cycleStatus(row: DashboardRow) {
    if (row.status === -1) row.status = 0;
    else row.status = (row.status + 1) % 3;
    this.triggerSave();
  }

  // Global Derived Logic
  getDerivedGlobalValue(): number {
    const snap = this.activeSnapshot;
    const contributing = snap.rows.filter(r => r.traj >= 0 && r.traj <= 2 && r.weight > 0);
    if (!contributing.length) return -1;
    let num = 0, den = 0;
    contributing.forEach(r => { num += r.weight * r.traj; den += r.weight; });
    return num / den;
  }

  get effectiveGlobalPos(): number {
    const snap = this.activeSnapshot;
    if (snap.globalTrajMode === 'manual') return snap.globalTrajManual;
    return this.getDerivedGlobalValue();
  }

  // UI Helpers
  getFaceColor(val: number): string {
    if (val === 0) return 'var(--status-red)';
    if (val === 1) return 'var(--status-amber)';
    if (val === 2) return 'var(--status-green)';
    return 'transparent';
  }

  getPointerPosition(val: number): string {
    if (val === -1 || val == null) return '50%';
    return `${16.6667 + val * 33.3333}%`;
  }
}
