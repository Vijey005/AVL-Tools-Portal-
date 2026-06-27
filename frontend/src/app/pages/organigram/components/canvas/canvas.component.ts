import {
 Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
 AfterViewInit, AfterViewChecked, OnDestroy,
 ElementRef, ViewChild, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
 OrganigramState, SvgPath, ContactOptions,
 Person, Coordinator, WorkPackage, SideRole, BottomRole,
 mkPerson, entryToPerson,
} from '../../models/organigram.models';
import { ContentEditableDirective } from '../../directives/contenteditable.directive';
import { PersonCardComponent } from '../person-card/person-card.component';

export interface CanvasEvents {
 // Chart title / subtitle
 titleChange: string;
 subtitleChange: string;
 // PM
 pmTitleChange: string;
 pmNameChange: string;
 // Side roles
 addSideRole: void;
 removeSideRole: number;
 sideRoleChange: { idx: number; field: 'name' | 'role'; value: string };
 // Coordinators
 addCoord: void;
 addCoordFromDir: void;
 removeCoord: number;
 coordTitleChange: { idx: number; value: string };
 coordPersonChange: { idx: number; partial: Partial<Coordinator> };
 toggleCoordSide: number;
 toggleCoordLine: number;
 // WPs
 addWp: void;
 removeWp: number;
 wpIdChange: { wpIdx: number; value: string };
 wpTitleChange: { wpIdx: number; value: string };
 addWpLead: { wpIdx: number; fromDir: boolean };
 removeWpLead: { wpIdx: number; personIdx: number };
 wpLeadChange: { wpIdx: number; personIdx: number; partial: Partial<Person> };
 addWpMember: { wpIdx: number; fromDir: boolean };
 removeWpMember: { wpIdx: number; personIdx: number };
 wpMemberChange: { wpIdx: number; personIdx: number; partial: Partial<Person> };
 // Teams
 teamLabelChange: { wpIdx: number; value: string };
 addTeamMember: { wpIdx: number; fromDir: boolean };
 removeTeamMember: { wpIdx: number; memberIdx: number };
 teamMemberChange: { wpIdx: number; memberIdx: number; partial: Partial<Person> };
 // Bottom roles
 addBottomRole: void;
 removeBottomRole: number;
 bottomRoleChange: { idx: number; field: 'role' | 'name'; value: string };
}

@Component({
 selector: 'app-org-canvas',
 standalone: true,
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [CommonModule, ContentEditableDirective, PersonCardComponent],
 templateUrl: './canvas.component.html',
 styleUrls: ['./canvas.component.css'],
})
export class CanvasComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
 @Input() state!: OrganigramState;
 @Input() isEditMode = true;
 @Input() svgPaths: SvgPath[] = [];

 // All canvas events bubble up through a single typed emitter
 @Output() ev = new EventEmitter<{ type: keyof CanvasEvents; payload?: any }>();

 @ViewChild('treeArea', { static: false }) treeAreaRef!: ElementRef<HTMLElement>;
 @ViewChild('canvasEl', { static: false }) canvasElRef!: ElementRef<HTMLElement>;

 private _needsRedraw = false;
 private _resizeObserver: ResizeObserver | null = null;
 private _rafId = 0;

 constructor(private cdr: ChangeDetectorRef) {}

 // ── Helper to emit typed events ───────────────────────────
 emit<K extends keyof CanvasEvents>(type: K, payload?: CanvasEvents[K]): void {
  this.ev.emit({ type, payload });
 }

 // ── Derived getters ───────────────────────────────────────
 get coordsLeft(): Coordinator[] { return this.state?.coordinators?.filter(c => c.side === 'left') ?? []; }
 get coordsRight(): Coordinator[] { return this.state?.coordinators?.filter(c => c.side === 'right') ?? []; }
 get coordContactOpts(): ContactOptions { return this.state?.options?.coordContact ?? { photo:false, post:false, email:false, phone:false }; }
 get wpContactOpts():  ContactOptions { return this.state?.options?.wpContact  ?? { photo:false, post:false, email:false, phone:false }; }
 get teamContactOpts(): ContactOptions { return this.state?.options?.teamContact ?? { photo:false, post:false, email:false, phone:false }; }

 coordIdxInFull(side: 'left'|'right', localIdx: number): number {
  const list = this.state.coordinators.filter(c => c.side === side);
  const entry = list[localIdx];
  return this.state.coordinators.indexOf(entry);
 }

 trackByIdx(idx: number): number { return idx; }

 // ── Lifecycle ─────────────────────────────────────────────

 ngAfterViewInit(): void {
  if (typeof ResizeObserver !== 'undefined' && this.treeAreaRef?.nativeElement) {
   this._resizeObserver = new ResizeObserver(() => this.scheduleRedraw());
   this._resizeObserver.observe(this.treeAreaRef.nativeElement);
  }
  this.scheduleRedraw();
 }

 ngAfterViewChecked(): void {
  if (this._needsRedraw) {
   this._needsRedraw = false;
   this.computeAndEmitSvgPaths();
  }
 }

 ngOnDestroy(): void {
  this._resizeObserver?.disconnect();
  cancelAnimationFrame(this._rafId);
 }

 scheduleRedraw(): void {
  cancelAnimationFrame(this._rafId);
  this._rafId = requestAnimationFrame(() => {
   this._needsRedraw = true;
   this.cdr.markForCheck();
  });
 }

 // ── SVG Path Computation ──────────────────────────────────

 private computeAndEmitSvgPaths(): void {
  if (!this.treeAreaRef?.nativeElement) return;
  const tree = this.treeAreaRef.nativeElement;
  const rect = tree.getBoundingClientRect();
  if (!rect.width) return;

  const center = (el: HTMLElement) => {
   const r = el.getBoundingClientRect();
   return {
    x:   r.left - rect.left + r.width / 2,
    top:  r.top - rect.top,
    bottom: r.bottom - rect.top,
    right: r.right - rect.left,
    left:  r.left  - rect.left,
   };
  };

  const paths: SvgPath[] = [];

  const pmCard = tree.querySelector('.pm-card') as HTMLElement | null;
  if (!pmCard) return;
  const pmC = center(pmCard);

  const wps  = Array.from(tree.querySelectorAll('.wp-card'))  as HTMLElement[];
  const teams = Array.from(tree.querySelectorAll('.team-block')) as HTMLElement[];
  const coordCards = Array.from(tree.querySelectorAll('.coord-card')) as HTMLElement[];

  let busYwp = pmC.bottom + 40;
  if (wps.length) {
   const topWp = center(wps[0]);
   busYwp = topWp.top - 18;
  }
  const busX = pmC.x;

  // PM vertical drop
  paths.push({ d: `M ${busX} ${pmC.bottom} L ${busX} ${busYwp}`, dashed: false });

  // Coordinator lines
  if (this.state.options.showCoordinators && coordCards.length) {
   coordCards.forEach(card => {
    const dataIdx = parseInt(card.getAttribute('data-idx') ?? '0', 10);
    const c = this.state.coordinators[dataIdx];
    if (!c) return;
    const cc = center(card);
    const yMid = (cc.top + cc.bottom) / 2;
    if (yMid < pmC.bottom || yMid > busYwp) return;
    const innerX = c.side === 'left' ? cc.right : cc.left;
    paths.push({ d: `M ${innerX} ${yMid} L ${busX} ${yMid}`, dashed: c.lineStyle === 'dashed' });
   });
  }

  // WP horizontal bus + verticals
  if (wps.length) {
   let busLeft = busX, busRight = busX;
   wps.forEach(wp => {
    const c = center(wp);
    busLeft = Math.min(busLeft, c.x);
    busRight = Math.max(busRight, c.x);
   });
   if (busRight > busLeft) {
    paths.push({ d: `M ${busLeft} ${busYwp} L ${busRight} ${busYwp}`, dashed: false });
   }
   wps.forEach((wp, i) => {
    const c = center(wp);
    paths.push({ d: `M ${c.x} ${busYwp} L ${c.x} ${c.top}`, dashed: false });
    if (this.state.options.showTeamLabels && teams[i]) {
     const label = teams[i].querySelector('.team-label') as HTMLElement | null;
     if (label) {
      const lc = center(label);
      paths.push({ d: `M ${c.x} ${c.bottom} L ${c.x} ${lc.top}`, dashed: false });
     }
    }
   });
  }

  // Emit paths upward so parent can store in signal
  this.ev.emit({ type: 'pmTitleChange' as any, payload: { __svgPaths: paths } });
 }
}
