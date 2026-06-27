import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation,
  NgZone, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

/* ─────────────────────────────────────────────────────────────
   AVL Organigram Creator — Angular wrapper
   Strategy: all vanilla JS logic runs in ngAfterViewInit exactly
   as in the original HTML file. ViewEncapsulation.None lets the
   original CSS work without modification. ApiService wires
   load/save to the real backend.
───────────────────────────────────────────────────────────── */

@Component({
  selector: 'app-organigram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './organigram.component.html',
  styleUrls: ['./organigram.component.css'],
  encapsulation: ViewEncapsulation.None,   // ← critical: no shadow DOM
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganigramComponent implements OnInit, AfterViewInit, OnDestroy {

  fileId!: number;
  loading = true;
  loadError = '';
  private initialPayload: string | null = null;
  private destroy$ = new Subject<void>();
  private saveSubject = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private zone: NgZone,
    private hostEl: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
    this.api.getFile(this.fileId).pipe(takeUntil(this.destroy$)).subscribe({
      next: file => {
        this.initialPayload = file.json_payload;
        this.loading = false;
        // Force OnPush to re-render the template so the DOM exists
        this.cdr.detectChanges();
        // Yield one tick so Angular finishes painting before we query DOM
        this.zone.runOutsideAngular(() =>
          setTimeout(() => this.bootOrgApp(file.json_payload), 0)
        );
      },
      error: (err) => {
        this.loadError = err.error?.detail || 'Failed to load organigram.';
        this.loading = false;
        this.cdr.detectChanges();
        this.zone.runOutsideAngular(() =>
          setTimeout(() => this.bootOrgApp(null), 0)
        );
      },
    });

    // Debounced auto-save
    this.saveSubject.pipe(
      debounceTime(1500),
      takeUntil(this.destroy$),
    ).subscribe(() => this.doSave());
  }

  ngAfterViewInit(): void {
    // If data already loaded before view was ready, boot happens in ngOnInit callback.
    // Otherwise it boots after data arrives.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Clean up global listeners added by orgApp
    if ((window as any).__orgAppCleanup) (window as any).__orgAppCleanup();
  }

  private doSave(): void {
    const stateGetter = (window as any).__orgGetState;
    if (!stateGetter) return;
    const payload = stateGetter();
    this.zone.run(() => {
      this.api.updateFile(this.fileId, { json_payload: payload })
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    });
  }

  triggerSave(): void { this.saveSubject.next(); }

  /* ────────────────────────────────────────────────────────
     Full organigram app — ported directly from the HTML file.
     Runs outside Angular zone for performance.
  ──────────────────────────────────────────────────────── */
  private bootOrgApp(payloadStr: string | null): void {

    const host = this.hostEl.nativeElement;
    const triggerSave = () => this.saveSubject.next();

    // ── Helpers ──────────────────────────────────────────

    function esc(s: any): string {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function initials(name: string = ''): string {
      const parts = String(name).split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    function genId(): string {
      return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    function clone(o: any): any { return JSON.parse(JSON.stringify(o)); }

    const $ = (s: string): HTMLElement | null => host.querySelector(s);
    const $$ = (s: string): NodeListOf<HTMLElement> => host.querySelectorAll(s);

    // ── Status toast ──────────────────────────────────────

    let statusTimer: any;
    function showStatus(msg: string, type: 'info' | 'success' | 'error' = 'info', ms = 2500) {
      const s = host.querySelector('#status') as HTMLElement;
      if (!s) return;
      s.textContent = msg;
      s.className = `status show ${type}`;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => s.classList.remove('show'), ms);
    }

    // ── Default state ─────────────────────────────────────

    function mkPerson(name = ''): any {
      return { name, post: '', photo: '', email: '', phone: '', dirId: '' };
    }
    function toPerson(v: any): any {
      if (v && typeof v === 'object') {
        return { name: v.name || '', post: v.post || '', photo: v.photo || '',
                 email: v.email || '', phone: v.phone || '', dirId: v.dirId || '' };
      }
      return mkPerson(String(v || ''));
    }

    const DEFAULT_STATE: any = {
      title: 'REx Project', subtitle: 'Project team AVL',
      sideRoles: [
        { name: 'Gerald Mair',    role: 'Project Coordination' },
        { name: 'Sylvain Joyeux', role: 'Project director AVL LMM' },
        { name: 'Yassine DILOO',  role: 'TCM' },
        { name: 'Rene Muller',    role: 'KAM' },
      ],
      pm: { title: 'Project Manager', name: 'Sebastien Dulphy' },
      coordinators: [
        { title: 'Technical product manager',     name: 'Haarith Mukundan',        post: '', photo: '', email: '', phone: '', dirId: '', side: 'left',  lineStyle: 'dashed' },
        { title: 'Technical Leader',              name: 'Morgan Guillochin (TBC)', post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid'  },
        { title: 'Global Technical Coordination', name: '(Name)',                  post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid'  },
      ],
      workPackages: [
        { id: 'WP1', title: 'HEVC Systems',       leads: [mkPerson('Thomas Carayol')],                                    members: [], team: { label: 'Systems Team',              members: [] } },
        { id: 'WP2', title: 'SW ASW Development', leads: [mkPerson('Lucas Monteil')],                                     members: [], team: { label: 'SW Team',                   members: [] } },
        { id: 'WP3', title: 'PWT Integration',    leads: [mkPerson('Bruno Serre (HW)'), mkPerson('Daniel Cabrita (EE)')], members: [], team: { label: 'Design & Integration Team', members: [] } },
        { id: 'WP4', title: 'Tuning & testing',   leads: [mkPerson('Arnaud Etheve')],                                     members: [], team: { label: 'Tuning & Testing Team',     members: [] } },
      ],
      bottomRoles: [
        { role: 'Design Lead Engineer',  name: 'Bruno Tedde'    },
        { role: 'Systems Lead Engineer', name: 'Thomas Adan'    },
        { role: 'EDU Product Manager',   name: 'Quentin Bassi'  },
        { role: 'ICE Product Manager',   name: 'Benjamin Moulene' },
      ],
      options: {
        showSideRoles: true, showCoordinators: true, showTeamLabels: true, showBottom: true,
        coordContact: { photo: false, post: false, email: false, phone: false },
        wpContact:    { photo: false, post: false, email: false, phone: false },
        teamContact:  { photo: false, post: false, email: false, phone: false },
      },
    };

    // ── State normalization ───────────────────────────────

    function normalizeState(data: any): any {
      const d = clone(data || {});
      const def = DEFAULT_STATE;
      if (typeof d.title    !== 'string') d.title    = '';
      if (typeof d.subtitle !== 'string') d.subtitle = '';
      if (!Array.isArray(d.sideRoles)) d.sideRoles = [];
      if (!d.pm) d.pm = clone(def.pm);
      if (!Array.isArray(d.coordinators)) {
        d.coordinators = [];
        if (d.tpm) d.coordinators.push({ title: d.tpm.title || '', name: d.tpm.name || '', side: 'left',  lineStyle: 'dashed' });
        if (d.tl)  d.coordinators.push({ title: d.tl.title  || '', name: d.tl.name  || '', side: 'right', lineStyle: 'solid'  });
      }
      delete d.tpm; delete d.tl;
      d.coordinators = d.coordinators.map((c: any) => ({
        title: c.title || '', name: c.name || '', post: c.post || '', photo: c.photo || '',
        email: c.email || '', phone: c.phone || '', dirId: c.dirId || '',
        side: c.side === 'right' ? 'right' : 'left',
        lineStyle: c.lineStyle === 'dashed' ? 'dashed' : 'solid',
      }));
      if (!Array.isArray(d.workPackages) || !d.workPackages.length) d.workPackages = clone(def.workPackages);
      d.workPackages = d.workPackages.map((wp: any) => {
        const leads   = Array.isArray(wp.leads)   ? wp.leads.map(toPerson)   : [];
        const members = Array.isArray(wp.members) ? wp.members.map(toPerson) : [];
        const tm = wp.team && typeof wp.team === 'object'
          ? { label: wp.team.label || wp.teamLabel || '', members: Array.isArray(wp.team.members) ? wp.team.members.map(toPerson) : [] }
          : { label: wp.teamLabel || '', members: [] };
        return { id: wp.id || 'WP?', title: wp.title || '',
          leads: leads.length ? leads : [mkPerson('(Lead)')], members, team: tm };
      });
      if (!Array.isArray(d.bottomRoles)) d.bottomRoles = [];
      const defOpts = def.options;
      const o: any = Object.assign({}, defOpts, d.options || {});
      o.coordContact = Object.assign({}, defOpts.coordContact, (d.options || {}).coordContact || {});
      o.wpContact    = Object.assign({}, defOpts.wpContact,    (d.options || {}).wpContact    || {});
      o.teamContact  = Object.assign({}, defOpts.teamContact,  (d.options || {}).teamContact  || {});
      d.options = o;
      return d;
    }

    // ── Load initial state ────────────────────────────────

    let state: any;
    try {
      if (payloadStr) {
        const parsed = JSON.parse(payloadStr);
        // Handle old rootNode format from previous stub
        state = normalizeState(parsed.workPackages ? parsed : DEFAULT_STATE);
      } else {
        state = normalizeState(DEFAULT_STATE);
      }
    } catch { state = normalizeState(DEFAULT_STATE); }

    // Expose state getter for Angular save pipeline
    (window as any).__orgGetState = () => JSON.stringify(state);

    // ── Directory (API-backed) ────────────────────────────
    // Directory stored via api — loaded separately. Falls back to localStorage for immediate availability.
    const DIRECTORY_KEY = 'avl_organigram_directory_v2';
    let directory: any[] = [];

    function loadDirectory() {
      try {
        const text = localStorage.getItem(DIRECTORY_KEY);
        if (!text) { directory = []; return; }
        const data = JSON.parse(text);
        directory = Array.isArray(data.entries) ? data.entries.map((e: any) => ({
          id: e.id || genId(), name: e.name || '', post: e.post || '',
          email: e.email || '', phone: e.phone || '', photo: e.photo || '',
        })) : [];
      } catch { directory = []; }
    }
    function saveDirectory() {
      try {
        localStorage.setItem(DIRECTORY_KEY, JSON.stringify({ version: 1, entries: directory }));
        updateDirectoryCountBadge();
      } catch { showStatus('Could not save directory', 'error'); }
    }
    function updateDirectoryCountBadge() {
      const el = host.querySelector('#dirCount') as HTMLElement;
      if (el) el.textContent = String(directory.length);
    }
    function findDirectoryEntry(id: string) { return directory.find((e: any) => e.id === id); }
    function entryToPerson(entry: any): any {
      return { name: entry.name || '', post: entry.post || '', photo: entry.photo || '',
               email: entry.email || '', phone: entry.phone || '', dirId: entry.id || '' };
    }

    // ── Photo upload ──────────────────────────────────────

    function resizePhoto(file: File, maxSize = 200): Promise<string> {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(maxSize / w, maxSize / h, 1);
          const cw = Math.round(w * scale), ch = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
          URL.revokeObjectURL(url);
          try { resolve(canvas.toDataURL('image/jpeg', 0.82)); } catch (e) { reject(e); }
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      });
    }
    function uploadPhoto(targetObj: any, cb?: () => void) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        try {
          targetObj.photo = await resizePhoto(file, 200);
          cb && cb();
        } catch { showStatus('Could not read image', 'error'); }
      };
      input.click();
    }

    // ── Person-row renderer ───────────────────────────────

    function personRowHtml(person: any, idx: number, contactOpts: any, opt: any = {}): string {
      const showPhoto = !!contactOpts.photo, showPost = !!contactOpts.post;
      const showEmail = !!contactOpts.email, showPhone = !!contactOpts.phone;
      const photoStyle = person.photo ? `background-image:url('${person.photo}');background-color:transparent;` : '';
      const avatarClass = opt.avatarSize === 'small' ? 'small' : opt.avatarSize === 'tiny' ? 'tiny' : '';
      const initialsTxt = person.photo ? '' : initials(person.name);
      return `
        <div class="person-row" data-i="${idx}">
          ${showPhoto ? `<div class="avatar ${avatarClass} ${person.photo ? 'has-photo' : ''}" style="${photoStyle}" data-action="upload-photo" data-i="${idx}" title="Click to upload photo">${esc(initialsTxt)}</div>` : ''}
          <div class="person-info">
            <div class="person-name" contenteditable="true" data-field="name" data-i="${idx}" data-placeholder="${esc(opt.namePlaceholder || 'Name')}">${esc(person.name || '')}</div>
            ${showPost  ? `<div class="person-post" contenteditable="true" data-field="post" data-i="${idx}" data-placeholder="Post / job title">${esc(person.post || '')}</div>` : ''}
            ${showEmail ? `<div class="contact-line"><span class="ico">✉</span><span class="ct-text" contenteditable="true" data-field="email" data-i="${idx}" data-placeholder="email@avl.com">${esc(person.email || '')}</span></div>` : ''}
            ${showPhone ? `<div class="contact-line"><span class="ico">☎</span><span class="ct-text" contenteditable="true" data-field="phone" data-i="${idx}" data-placeholder="+xx ...">${esc(person.phone || '')}</span></div>` : ''}
          </div>
          <button class="row-del" data-i="${idx}" title="Remove">×</button>
        </div>`;
    }

    function attachPersonRowHandlers(container: HTMLElement, list: any[]) {
      container.querySelectorAll('[data-action="upload-photo"]').forEach(el => {
        (el as HTMLElement).onclick = () => {
          const i = +(el as HTMLElement).dataset['i']!;
          uploadPhoto(list[i], () => { renderAll(); triggerSave(); showStatus('Photo updated', 'success', 1500); });
        };
      });
      container.querySelectorAll('[contenteditable="true"][data-field]').forEach(el => {
        (el as HTMLElement).oninput = (e: any) => {
          const i = +(el as HTMLElement).dataset['i']!;
          const f = (el as HTMLElement).dataset['field']!;
          list[i][f] = e.target.textContent;
          triggerSave();
        };
      });
      container.querySelectorAll('.row-del').forEach(btn => {
        (btn as HTMLElement).onclick = () => { list.splice(+(btn as HTMLElement).dataset['i']!, 1); renderAll(); triggerSave(); };
      });
    }

    // ── Render functions ──────────────────────────────────

    function renderAll() {
      renderSideRoles(); renderCoordinators(); renderWorkPackages();
      renderTeams(); renderBottomRoles(); renderBindings(); applyOptions();
      updateDirectoryCountBadge();
      requestAnimationFrame(() => requestAnimationFrame(drawLines));
    }

    function renderBindings() {
      host.querySelectorAll('[data-bind]').forEach(el => {
        const k = (el as HTMLElement).dataset['bind'];
        let v = '';
        if (k === 'title')    v = state.title;
        if (k === 'subtitle') v = state.subtitle;
        if (k === 'pmTitle')  v = state.pm.title;
        if (k === 'pmName')   v = state.pm.name;
        if (el.textContent !== v) el.textContent = v;
      });
    }

    function renderSideRoles() {
      const host2 = $('[data-zone="sideRoles"]')!;
      host2.innerHTML = '';
      state.sideRoles.forEach((r: any, idx: number) => {
        const div = document.createElement('div');
        div.className = 'side-role';
        div.innerHTML = `
          <button class="del-btn" title="Remove">✕</button>
          <div class="name" contenteditable="true" data-placeholder="Name">${esc(r.name)}</div>
          <div class="role" contenteditable="true" data-placeholder="Role">${esc(r.role)}</div>`;
        (div.querySelector('.del-btn') as HTMLElement).onclick = () => { state.sideRoles.splice(idx, 1); renderAll(); triggerSave(); };
        (div.querySelector('.name') as HTMLElement).oninput = (e: any) => { state.sideRoles[idx].name = e.target.textContent; triggerSave(); };
        (div.querySelector('.role') as HTMLElement).oninput = (e: any) => { state.sideRoles[idx].role = e.target.textContent; triggerSave(); };
        host2.appendChild(div);
      });
      const addWrap = document.createElement('div');
      addWrap.className = 'add-row'; addWrap.style.justifyContent = 'flex-start';
      addWrap.innerHTML = `<button class="add-inline">+ Add Side Role</button>`;
      (addWrap.querySelector('button') as HTMLElement).onclick = () => { state.sideRoles.push({ name: 'New Person', role: 'Role' }); renderAll(); triggerSave(); };
      host2.appendChild(addWrap);
    }

    function renderCoordinators() {
      ($('[data-zone="coordLeft"]') as HTMLElement).innerHTML = '';
      ($('[data-zone="coordRight"]') as HTMLElement).innerHTML = '';
      const cc = state.options.coordContact;
      const anyContact = cc.photo || cc.post || cc.email || cc.phone;
      state.coordinators.forEach((c: any, idx: number) => {
        const div = document.createElement('div');
        div.className = 'card coord-card'; div.dataset['idx'] = String(idx);
        const personHtml = personRowHtml(c, idx, cc, { namePlaceholder: 'Name', avatarSize: 'small' });
        div.innerHTML = `
          <button class="del-btn" title="Remove coordinator">✕</button>
          <div class="card-actions">
            <span class="pill side-pill" title="Toggle left/right">${c.side === 'left' ? '◀ left' : 'right ▶'}</span>
            <span class="pill line-pill ${c.lineStyle === 'dashed' ? 'active' : ''}" title="Toggle line style">${c.lineStyle === 'dashed' ? '┄ dashed' : '── solid'}</span>
          </div>
          <div class="header-bar" contenteditable="true" data-placeholder="Title">${esc(c.title)}</div>
          <div class="name-bar ${anyContact ? 'with-contact' : ''}">${personHtml}</div>`;
        (div.querySelector('.del-btn') as HTMLElement).onclick = () => { state.coordinators.splice(idx, 1); renderAll(); triggerSave(); };
        (div.querySelector('.header-bar') as HTMLElement).oninput = (e: any) => { state.coordinators[idx].title = e.target.textContent; triggerSave(); };
        (div.querySelector('.side-pill') as HTMLElement).onclick = () => { state.coordinators[idx].side = state.coordinators[idx].side === 'left' ? 'right' : 'left'; renderAll(); triggerSave(); };
        (div.querySelector('.line-pill') as HTMLElement).onclick = () => { state.coordinators[idx].lineStyle = state.coordinators[idx].lineStyle === 'dashed' ? 'solid' : 'dashed'; renderAll(); triggerSave(); };
        const rowDel = div.querySelector('.person-row .row-del') as HTMLElement;
        if (rowDel) rowDel.style.display = 'none';
        div.querySelectorAll('[contenteditable="true"][data-field]').forEach(el => {
          (el as HTMLElement).oninput = (e: any) => { state.coordinators[idx][(el as HTMLElement).dataset['field']!] = e.target.textContent; triggerSave(); };
        });
        const av = div.querySelector('[data-action="upload-photo"]') as HTMLElement;
        if (av) av.onclick = () => uploadPhoto(state.coordinators[idx], () => { renderAll(); triggerSave(); showStatus('Photo updated', 'success', 1500); });
        (c.side === 'left' ? $('[data-zone="coordLeft"]') : $('[data-zone="coordRight"]'))!.appendChild(div);
      });
    }

    function renderWorkPackages() {
      const host2 = $('[data-zone="wpRow"]')!;
      host2.innerHTML = '';
      const wc = state.options.wpContact;
      state.workPackages.forEach((wp: any, idx: number) => {
        const div = document.createElement('div');
        div.className = 'card wp-card'; div.dataset['idx'] = String(idx);
        const hasMembers = wp.members.length > 0;
        const leadsHtml   = wp.leads.map((p: any, i: number) => personRowHtml(p, i, wc, { namePlaceholder: 'Lead name',   avatarSize: 'tiny' })).join('');
        const membersHtml = wp.members.map((p: any, i: number) => personRowHtml(p, i, wc, { namePlaceholder: 'Member name', avatarSize: 'tiny' })).join('');
        div.innerHTML = `
          <button class="del-btn" title="Remove WP">✕</button>
          <div class="header-bar">
            <span class="wp-id" contenteditable="true" data-placeholder="ID">${esc(wp.id)}</span>:
            <span class="wp-title" contenteditable="true" data-placeholder="Title">${esc(wp.title)}</span>
          </div>
          <div class="name-bar">
            <div class="leads-list">${leadsHtml}</div>
            <div class="add-inrow-group">
              <button class="add-inrow add-lead" type="button">+ add lead</button>
              <button class="add-inrow dir add-lead-dir" type="button">📇</button>
            </div>
          </div>
          <div class="members-section ${hasMembers ? '' : 'empty'}">
            ${hasMembers ? '<div class="members-title">Members</div>' : ''}
            <div class="members-list">${membersHtml}</div>
            <div class="add-inrow-group">
              <button class="add-inrow add-member" type="button">+ add position</button>
              <button class="add-inrow dir add-member-dir" type="button">📇</button>
            </div>
          </div>`;
        (div.querySelector('.del-btn') as HTMLElement).onclick = () => {
          if (state.workPackages.length <= 1) { showStatus('Need at least one WP', 'error'); return; }
          state.workPackages.splice(idx, 1); renderAll(); triggerSave();
        };
        (div.querySelector('.wp-id') as HTMLElement).oninput    = (e: any) => { state.workPackages[idx].id    = e.target.textContent; triggerSave(); };
        (div.querySelector('.wp-title') as HTMLElement).oninput = (e: any) => { state.workPackages[idx].title = e.target.textContent; triggerSave(); };
        attachPersonRowHandlers(div.querySelector('.leads-list')!,   state.workPackages[idx].leads);
        attachPersonRowHandlers(div.querySelector('.members-list')!, state.workPackages[idx].members);
        (div.querySelector('.add-lead') as HTMLElement).onclick = () => { state.workPackages[idx].leads.push(mkPerson('New Lead')); renderAll(); triggerSave(); };
        (div.querySelector('.add-member') as HTMLElement).onclick = () => { state.workPackages[idx].members.push(mkPerson('New Position')); renderAll(); triggerSave(); };
        (div.querySelector('.add-lead-dir') as HTMLElement).onclick = () => { openDirectoryPicker((entry: any) => { state.workPackages[idx].leads.push(entryToPerson(entry)); renderAll(); triggerSave(); }); };
        (div.querySelector('.add-member-dir') as HTMLElement).onclick = () => { openDirectoryPicker((entry: any) => { state.workPackages[idx].members.push(entryToPerson(entry)); renderAll(); triggerSave(); }); };
        host2.appendChild(div);
      });
    }

    function renderTeams() {
      const host2 = $('[data-zone="teamRow"]')!;
      host2.innerHTML = '';
      const tc = state.options.teamContact;
      state.workPackages.forEach((wp: any, idx: number) => {
        const block = document.createElement('div');
        block.className = 'team-block'; block.dataset['idx'] = String(idx);
        const membersHtml = wp.team.members.map((p: any, i: number) => personRowHtml(p, i, tc, { namePlaceholder: 'Position', avatarSize: 'tiny' })).join('');
        block.innerHTML = `
          <div class="team-label" contenteditable="true" data-placeholder="Team Name">${esc(wp.team.label)}</div>
          <div class="team-members">${membersHtml}</div>
          <div class="add-inrow-group" style="margin-top:4px">
            <button class="add-inrow add-tmem" type="button">+ add team position</button>
            <button class="add-inrow dir add-tmem-dir" type="button">📇</button>
          </div>`;
        (block.querySelector('.team-label') as HTMLElement).oninput = (e: any) => { state.workPackages[idx].team.label = e.target.textContent; triggerSave(); };
        attachPersonRowHandlers(block.querySelector('.team-members')!, state.workPackages[idx].team.members);
        (block.querySelector('.add-tmem') as HTMLElement).onclick = () => { state.workPackages[idx].team.members.push(mkPerson('New Position')); renderAll(); triggerSave(); };
        (block.querySelector('.add-tmem-dir') as HTMLElement).onclick = () => { openDirectoryPicker((entry: any) => { state.workPackages[idx].team.members.push(entryToPerson(entry)); renderAll(); triggerSave(); }); };
        host2.appendChild(block);
      });
    }

    function renderBottomRoles() {
      const host2 = $('[data-zone="bottomRoles"]')!;
      host2.innerHTML = '';
      state.bottomRoles.forEach((r: any, idx: number) => {
        const div = document.createElement('div');
        div.className = 'bottom-role';
        div.innerHTML = `
          <button class="del-btn" title="Remove">✕</button>
          <span class="role-label" contenteditable="true" data-placeholder="Role Title">${esc(r.role)}:</span>
          <span class="role-name"  contenteditable="true" data-placeholder="Name">${esc(r.name)}</span>`;
        (div.querySelector('.del-btn') as HTMLElement).onclick = () => { state.bottomRoles.splice(idx, 1); renderAll(); triggerSave(); };
        (div.querySelector('.role-label') as HTMLElement).oninput = (e: any) => { state.bottomRoles[idx].role = e.target.textContent.replace(/:\s*$/, ''); triggerSave(); };
        (div.querySelector('.role-name') as HTMLElement).oninput  = (e: any) => { state.bottomRoles[idx].name = e.target.textContent; triggerSave(); };
        host2.appendChild(div);
      });
    }

    function applyOptions() {
      const o = state.options;
      ($('[data-zone="sideRoles"]')   as HTMLElement).style.display = o.showSideRoles    ? '' : 'none';
      ($('[data-zone="coordSection"]') as HTMLElement).style.display = o.showCoordinators ? 'flex' : 'none';
      ($('[data-zone="addCoordRow"]')  as HTMLElement).style.display = o.showCoordinators ? '' : 'none';
      ($('[data-zone="teamRow"]')      as HTMLElement).style.display = o.showTeamLabels   ? '' : 'none';
      ($('[data-zone="bottomRoles"]')  as HTMLElement).style.display = o.showBottom       ? '' : 'none';
      const optShowSideRoles    = host.querySelector('#optShowSideRoles')    as HTMLInputElement;
      const optShowCoordinators = host.querySelector('#optShowCoordinators') as HTMLInputElement;
      const optShowTeamLabels   = host.querySelector('#optShowTeamLabels')   as HTMLInputElement;
      const optShowBottom       = host.querySelector('#optShowBottom')       as HTMLInputElement;
      if (optShowSideRoles)    optShowSideRoles.checked    = o.showSideRoles;
      if (optShowCoordinators) optShowCoordinators.checked = o.showCoordinators;
      if (optShowTeamLabels)   optShowTeamLabels.checked   = o.showTeamLabels;
      if (optShowBottom)       optShowBottom.checked       = o.showBottom;
      ['coord', 'wp', 'team'].forEach(zone => {
        const key = zone + 'Contact';
        ['photo', 'post', 'email', 'phone'].forEach(field => {
          const cb = host.querySelector(`input[data-zone="${zone}"][data-field="${field}"]`) as HTMLInputElement;
          if (cb) cb.checked = !!o[key][field];
        });
      });
      const chartBody = host.querySelector('.chart-body') as HTMLElement;
      if (chartBody) chartBody.style.gridTemplateColumns = o.showSideRoles ? '200px 1fr' : '0 1fr';
    }

    // ── SVG Line Drawing ──────────────────────────────────

    function drawLines() {
      const svg  = host.querySelector('#linesSvg') as SVGElement;
      const tree = host.querySelector('[data-zone="treeArea"]') as HTMLElement;
      if (!svg || !tree) return;
      const rect = tree.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      svg.setAttribute('width',  String(rect.width));
      svg.setAttribute('height', String(rect.height));
      svg.innerHTML = '';
      function center(el: HTMLElement) {
        const r = el.getBoundingClientRect();
        return { x: r.left - rect.left + r.width / 2, top: r.top - rect.top, bottom: r.bottom - rect.top, right: r.right - rect.left, left: r.left - rect.left };
      }
      function addPath(d: string, dashed = false) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        if (dashed) p.classList.add('dashed');
        svg.appendChild(p);
      }
      const pm = host.querySelector('#pmCard') as HTMLElement;
      if (!pm) return;
      const pmC = center(pm);
      const wps   = Array.from(host.querySelectorAll('[data-zone="wpRow"] .wp-card'))   as HTMLElement[];
      const teams = Array.from(host.querySelectorAll('[data-zone="teamRow"] .team-block')) as HTMLElement[];
      const coordCards = Array.from(host.querySelectorAll('[data-zone="coordSection"] .coord-card')) as HTMLElement[];
      let busYwp = pmC.bottom + 40;
      if (wps.length) { const topWp = center(wps[0]); busYwp = topWp.top - 18; }
      const busX = pmC.x;
      addPath(`M ${busX} ${pmC.bottom} L ${busX} ${busYwp}`);
      if (state.options.showCoordinators && coordCards.length) {
        coordCards.forEach(card => {
          const idx = +card.dataset['idx']!;
          const c = state.coordinators[idx];
          if (!c) return;
          const cc = center(card);
          const yMid = (cc.top + cc.bottom) / 2;
          if (yMid < pmC.bottom || yMid > busYwp) return;
          addPath(`M ${c.side === 'left' ? cc.right : cc.left} ${yMid} L ${busX} ${yMid}`, c.lineStyle === 'dashed');
        });
      }
      if (wps.length) {
        let busLeft = busX, busRight = busX;
        wps.forEach(wp => { const c = center(wp); busLeft = Math.min(busLeft, c.x); busRight = Math.max(busRight, c.x); });
        if (busRight > busLeft) addPath(`M ${busLeft} ${busYwp} L ${busRight} ${busYwp}`);
        wps.forEach((wp, i) => {
          const c = center(wp);
          addPath(`M ${c.x} ${busYwp} L ${c.x} ${c.top}`);
          if (state.options.showTeamLabels && teams[i]) {
            const label = teams[i].querySelector('.team-label') as HTMLElement;
            if (label) { const lc = center(label); addPath(`M ${c.x} ${c.bottom} L ${c.x} ${lc.top}`); }
          }
        });
      }
    }

    // ── Contenteditable paste handler ─────────────────────

    function bindEditableHandlers() {
      host.querySelectorAll('[data-bind]').forEach(el => {
        el.addEventListener('input', e => {
          const k = (el as HTMLElement).dataset['bind'], v = (e.target as HTMLElement).textContent || '';
          if (k === 'title')    { state.title    = v; triggerSave(); }
          if (k === 'subtitle') { state.subtitle = v; triggerSave(); }
          if (k === 'pmTitle')  { state.pm.title = v; triggerSave(); }
          if (k === 'pmName')   { state.pm.name  = v; triggerSave(); }
        });
        el.addEventListener('paste', e => {
          e.preventDefault();
          const t = (e as ClipboardEvent).clipboardData?.getData('text') || '';
          document.execCommand('insertText', false, t);
        });
      });
    }

    // ── Modal system ──────────────────────────────────────

    function openModal(html: string) {
      const mc = host.querySelector('#modalContent') as HTMLElement;
      mc.innerHTML = html;
      (host.querySelector('#modalBackdrop') as HTMLElement).classList.add('open');
    }
    function closeModal() {
      (host.querySelector('#modalBackdrop') as HTMLElement).classList.remove('open');
      (host.querySelector('#modalContent') as HTMLElement).innerHTML = '';
    }

    // ── Directory Manager ─────────────────────────────────

    function openDirectoryManager() {
      const html = `
        <div class="modal-header">
          <div class="modal-title"><span class="ico">📇</span> People Directory
            <span class="count-badge" id="dirMgrCount">${directory.length} ${directory.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <div class="dir-toolbar">
            <input class="dir-search" id="dirSearch" placeholder="Search by name or post..." autofocus>
            <button class="btn primary" id="dirAddBtn">+ Add Person</button>
            <button class="btn" id="dirImportBtn">Import...</button>
            <button class="btn" id="dirExportBtn">⬇ Export</button>
            <button class="btn" id="dirShareBtn">🔗 Share</button>
          </div>
          <div class="dir-list" id="dirList"></div>
        </div>`;
      openModal(html);
      renderDirectoryList('', false);
      (host.querySelector('#modalCloseBtn') as HTMLElement).onclick = closeModal;
      (host.querySelector('#dirSearch') as HTMLElement).oninput = () => renderDirectoryList((host.querySelector('#dirSearch') as HTMLInputElement).value, false);
      (host.querySelector('#dirAddBtn') as HTMLElement).onclick = () => openEntryEditor(null, () => openDirectoryManager());
      (host.querySelector('#dirImportBtn') as HTMLElement).onclick = importDirectory;
      (host.querySelector('#dirExportBtn') as HTMLElement).onclick = exportDirectory;
      (host.querySelector('#dirShareBtn') as HTMLElement).onclick = shareDirectory;
    }

    function openDirectoryPicker(onPick: (e: any) => void) {
      if (directory.length === 0) {
        if (confirm('The directory is empty. Open the directory now to add people?')) openDirectoryManager();
        return;
      }
      const html = `
        <div class="modal-header">
          <div class="modal-title"><span class="ico">📇</span> Select from Directory
            <span class="count-badge">${directory.length} ${directory.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <div class="dir-toolbar">
            <input class="dir-search" id="dirSearch" placeholder="Search by name or post..." autofocus>
            <button class="btn" id="dirAddNewBtn">+ Add new...</button>
            <button class="btn" id="dirMgrBtn">Manage</button>
          </div>
          <div class="dir-list" id="dirList"></div>
        </div>`;
      openModal(html);
      renderDirectoryList('', true, onPick);
      (host.querySelector('#modalCloseBtn') as HTMLElement).onclick = closeModal;
      (host.querySelector('#dirSearch') as HTMLElement).oninput = () => renderDirectoryList((host.querySelector('#dirSearch') as HTMLInputElement).value, true, onPick);
      (host.querySelector('#dirAddNewBtn') as HTMLElement).onclick = () => openEntryEditor(null, (saved: any) => { if (saved) { onPick(saved); } else { openDirectoryPicker(onPick); } });
      (host.querySelector('#dirMgrBtn') as HTMLElement).onclick = openDirectoryManager;
    }

    function renderDirectoryList(filterText: string, pickerMode: boolean, onPick?: (e: any) => void) {
      const listHost = host.querySelector('#dirList') as HTMLElement;
      if (!listHost) return;
      const filter = filterText.trim().toLowerCase();
      const entries = directory
        .filter((e: any) => !filter || (e.name || '').toLowerCase().includes(filter) || (e.post || '').toLowerCase().includes(filter) || (e.email || '').toLowerCase().includes(filter))
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      if (entries.length === 0) {
        listHost.innerHTML = directory.length === 0
          ? `<div class="dir-empty"><div class="ico-big">📇</div><div>The directory is empty.</div><div style="margin-top:6px">Click <b>+ Add Person</b> to create your first entry, or <b>Import...</b> to load one from JSON.</div></div>`
          : `<div class="dir-empty"><div class="ico-big">🔍</div><div>No matches for "${esc(filter)}".</div></div>`;
        return;
      }
      listHost.innerHTML = entries.map((e: any) => {
        const photoStyle = e.photo ? `background-image:url('${e.photo}');background-color:transparent;` : '';
        return `<div class="dir-entry ${pickerMode ? 'clickable' : ''}" data-id="${esc(e.id)}">
          <div class="avatar small ${e.photo ? 'has-photo' : ''}" style="${photoStyle}">${e.photo ? '' : esc(initials(e.name))}</div>
          <div class="dir-entry-info">
            <div class="dir-entry-name">${esc(e.name || '(unnamed)')}</div>
            ${e.post ? `<div class="dir-entry-post">${esc(e.post)}</div>` : ''}
            <div class="dir-entry-contact">${esc([e.email, e.phone].filter(Boolean).join('  ·  '))}</div>
          </div>
          ${pickerMode ? '' : `<div class="dir-entry-actions"><button class="btn small" data-act="edit">Edit</button><button class="btn small danger" data-act="del">Delete</button></div>`}
        </div>`;
      }).join('');
      listHost.querySelectorAll('.dir-entry').forEach(row => {
        const id = (row as HTMLElement).dataset['id']!;
        if (pickerMode) {
          (row as HTMLElement).onclick = () => { const entry = findDirectoryEntry(id); if (entry) { closeModal(); onPick && onPick(entry); } };
        } else {
          (row.querySelector('[data-act="edit"]') as HTMLElement).onclick = (ev) => { ev.stopPropagation(); const entry = findDirectoryEntry(id); if (entry) openEntryEditor(entry, () => openDirectoryManager()); };
          (row.querySelector('[data-act="del"]') as HTMLElement).onclick = (ev) => {
            ev.stopPropagation();
            const entry = findDirectoryEntry(id); if (!entry) return;
            const btn = ev.currentTarget as HTMLButtonElement;
            if (btn.textContent === 'Delete') {
              btn.textContent = 'Confirm?';
              btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              btn.style.color = 'rgb(239, 68, 68)';
              setTimeout(() => {
                if (btn.textContent === 'Confirm?') {
                  btn.textContent = 'Delete';
                  btn.style.backgroundColor = '';
                  btn.style.color = '';
                }
              }, 3000);
              return;
            }
            directory = directory.filter((x: any) => x.id !== id);
            saveDirectory();
            const countEl = host.querySelector('#dirMgrCount') as HTMLElement;
            if (countEl) countEl.textContent = `${directory.length} ${directory.length === 1 ? 'entry' : 'entries'}`;
            renderDirectoryList((host.querySelector('#dirSearch') as HTMLInputElement)?.value || '', false);
          };
        }
      });
    }

    function openEntryEditor(existingEntry: any, onAfterSave: (e: any) => void) {
      const draft = existingEntry ? clone(existingEntry) : { id: genId(), name: '', post: '', email: '', phone: '', photo: '' };
      const isNew = !existingEntry;
      openModal(`
        <div class="modal-header">
          <div class="modal-title"><span class="ico">${isNew ? '➕' : '✏️'}</span> ${isNew ? 'Add Person' : 'Edit Person'}</div>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <div class="dir-editor">
            <div class="editor-photo-col">
              <div class="avatar large ${draft.photo ? 'has-photo' : ''}" id="editAvatar" style="${draft.photo ? `background-image:url('${draft.photo}');background-color:transparent;` : ''}" title="Click to upload">${draft.photo ? '' : esc(initials(draft.name))}</div>
              <div class="small-link" id="editPhotoLink">Upload photo</div>
              ${draft.photo ? '<div class="small-link" id="editPhotoRemove" style="color:var(--danger)">Remove</div>' : ''}
            </div>
            <div class="editor-fields">
              <div class="field"><label class="field-label">Name *</label><input type="text" id="ef_name" value="${esc(draft.name)}" placeholder="Full name"></div>
              <div class="field"><label class="field-label">Post</label><input type="text" id="ef_post" value="${esc(draft.post)}" placeholder="Job title"></div>
              <div class="field"><label class="field-label">Email</label><input type="email" id="ef_email" value="${esc(draft.email)}" placeholder="name@avl.com"></div>
              <div class="field"><label class="field-label">Phone</label><input type="tel" id="ef_phone" value="${esc(draft.phone)}" placeholder="+xx ..."></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          ${isNew ? '' : '<button class="btn danger" id="ef_delete">Delete</button>'}
          <div style="flex:1"></div>
          <button class="btn" id="ef_cancel">Cancel</button>
          <button class="btn primary" id="ef_save">${isNew ? 'Add to Directory' : 'Save'}</button>
        </div>`);

      const refreshAvatar = () => {
        const av = host.querySelector('#editAvatar') as HTMLElement;
        if (draft.photo) { av.style.backgroundImage = `url('${draft.photo}')`; av.style.backgroundColor = 'transparent'; av.classList.add('has-photo'); av.textContent = ''; }
        else { av.style.backgroundImage = ''; av.style.backgroundColor = ''; av.classList.remove('has-photo'); av.textContent = initials((host.querySelector('#ef_name') as HTMLInputElement).value); }
        const linkRow = av.parentElement!;
        let removeLink = linkRow.querySelector('#editPhotoRemove') as HTMLElement;
        if (draft.photo && !removeLink) {
          removeLink = document.createElement('div'); removeLink.id = 'editPhotoRemove'; removeLink.className = 'small-link'; removeLink.style.color = 'var(--danger)'; removeLink.textContent = 'Remove';
          removeLink.onclick = () => { draft.photo = ''; refreshAvatar(); }; linkRow.appendChild(removeLink);
        } else if (!draft.photo && removeLink) { removeLink.remove(); }
      };
      (host.querySelector('#modalCloseBtn') as HTMLElement).onclick = () => { if (onAfterSave) onAfterSave(null); else closeModal(); };
      (host.querySelector('#ef_cancel') as HTMLElement).onclick     = () => { if (onAfterSave) onAfterSave(null); else closeModal(); };
      (host.querySelector('#editAvatar') as HTMLElement).onclick    = () => uploadPhoto(draft, refreshAvatar);
      (host.querySelector('#editPhotoLink') as HTMLElement).onclick = () => uploadPhoto(draft, refreshAvatar);
      const initRemoveLink = host.querySelector('#editPhotoRemove') as HTMLElement;
      if (initRemoveLink) initRemoveLink.onclick = () => { draft.photo = ''; refreshAvatar(); };
      (host.querySelector('#ef_name') as HTMLElement).oninput = () => { if (!draft.photo) refreshAvatar(); };
      (host.querySelector('#ef_save') as HTMLElement).onclick = () => {
        draft.name  = (host.querySelector('#ef_name')  as HTMLInputElement).value.trim();
        draft.post  = (host.querySelector('#ef_post')  as HTMLInputElement).value.trim();
        draft.email = (host.querySelector('#ef_email') as HTMLInputElement).value.trim();
        draft.phone = (host.querySelector('#ef_phone') as HTMLInputElement).value.trim();
        if (!draft.name) { showStatus('Name is required', 'error'); (host.querySelector('#ef_name') as HTMLElement).focus(); return; }
        if (isNew) { directory.push(draft); }
        else { const idx = directory.findIndex((e: any) => e.id === draft.id); if (idx >= 0) directory[idx] = draft; else directory.push(draft); }
        saveDirectory(); showStatus(isNew ? 'Added to directory' : 'Updated', 'success');
        if (onAfterSave) onAfterSave(draft); else closeModal();
      };
      if (!isNew) {
        (host.querySelector('#ef_delete') as HTMLElement).onclick = (ev) => {
          const btn = ev.currentTarget as HTMLButtonElement;
          if (btn.textContent === 'Delete') {
            btn.textContent = 'Confirm?';
            btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            btn.style.color = 'rgb(239, 68, 68)';
            setTimeout(() => {
              if (btn.textContent === 'Confirm?') {
                btn.textContent = 'Delete';
                btn.style.backgroundColor = '';
                btn.style.color = '';
              }
            }, 3000);
            return;
          }
          directory = directory.filter((e: any) => e.id !== draft.id);
          saveDirectory(); showStatus('Removed from directory', 'success');
          if (onAfterSave) onAfterSave(null); else closeModal();
        };
      }
      setTimeout(() => (host.querySelector('#ef_name') as HTMLElement)?.focus(), 50);
    }

    function importDirectory() {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.onchange = async () => {
        const f = input.files?.[0]; if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          let entries: any[] = [];
          if (Array.isArray(data)) entries = data;
          else if (data && Array.isArray(data.entries)) entries = data.entries;
          else { showStatus('Unrecognized directory format', 'error'); return; }
          const normalized = entries.map((e: any) => ({ id: genId(), name: e.name || '', post: e.post || '', email: e.email || '', phone: e.phone || '', photo: e.photo || '' })).filter((e: any) => e.name);
          directory = directory.concat(normalized);
          saveDirectory(); showStatus(`Merged ${normalized.length} entries`, 'success');
          openDirectoryManager();
        } catch { showStatus('Invalid JSON file', 'error'); }
      };
      input.click();
    }

    async function exportDirectory() {
      const json = JSON.stringify({ version: 1, entries: directory }, null, 2);
      const fileName = `team_directory_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      showStatus('Directory downloaded', 'success');
    }

    function shareDirectory() {
      const email = prompt('Enter recipient email to share the directory:');
      if (!email) return;
      showStatus('Share feature requires backend integration', 'info', 3000);
    }

    // ── Toolbar bindings ──────────────────────────────────

    const btnEditToggle = host.querySelector('#btnEditToggle') as HTMLElement;
    const editLabel     = host.querySelector('#editLabel')     as HTMLElement;

    btnEditToggle.onclick = () => {
      const on = !host.classList.contains('edit-mode');
      host.classList.toggle('edit-mode', on);
      btnEditToggle.classList.toggle('on', on);
      editLabel.textContent = on ? 'Edit mode' : 'View mode';
      host.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable', on ? 'true' : 'false'));
      setTimeout(drawLines, 50);
    };

    function showNewChartConfirm() {
      const html = `
        <div class="modal-header">
          <div class="modal-title"><span class="ico">📄</span> Start New Chart</div>
          <button class="modal-close" id="modalCloseBtn">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: var(--text-muted);">Are you sure you want to clear the current chart and start blank? Unsaved changes will be lost.</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="confirmCancelBtn">Cancel</button>
          <button class="btn primary" id="confirmOkBtn">Yes, Start Blank</button>
        </div>`;
      openModal(html);
      (host.querySelector('#modalCloseBtn') as HTMLElement).onclick = closeModal;
      (host.querySelector('#confirmCancelBtn') as HTMLElement).onclick = closeModal;
      (host.querySelector('#confirmOkBtn') as HTMLElement).onclick = () => {
        closeModal();
        state = normalizeState({
          title: 'New Project',
          subtitle: 'Project team',
          pm: { title: 'Project Manager', name: '(Name)' },
          coordinators: [],
          workPackages: [{ id: 'WP1', title: 'Work Package 1', leads: [mkPerson('(Lead)')], members: [], team: { label: 'Team 1', members: [] } }],
          sideRoles: [],
          bottomRoles: [],
          options: clone(DEFAULT_STATE.options)
        });
        renderAll();
        triggerSave();
        showStatus('New chart created', 'success');
      };
    }

    (host.querySelector('#btnNew') as HTMLElement).onclick = () => {
      showNewChartConfirm();
    };

    (host.querySelector('#btnSave') as HTMLElement).onclick = async () => {
      const json = JSON.stringify(state, null, 2);
      const fileName = `${(state.title || 'organigram').replace(/[^a-z0-9_-]+/gi, '_')}.json`;
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
          const w = await handle.createWritable(); await w.write(json); await w.close();
          showStatus('Saved to ' + handle.name, 'success'); return;
        } catch (e: any) { if (e.name === 'AbortError') return; }
      }
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url); showStatus('Downloaded ' + fileName, 'success');
    };

    (host.querySelector('#btnLoad') as HTMLElement).onclick = async () => {
      if ('showOpenFilePicker' in window) {
        try {
          const [handle] = await (window as any).showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
          const file = await handle.getFile(); loadJsonText(await file.text()); return;
        } catch (e: any) { if (e.name === 'AbortError') return; }
      }
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.onchange = async () => { const f = input.files?.[0]; if (!f) return; loadJsonText(await f.text()); };
      input.click();
    };

    function loadJsonText(text: string) {
      try { state = normalizeState(JSON.parse(text)); renderAll(); triggerSave(); showStatus('Chart loaded', 'success'); }
      catch { showStatus('Invalid JSON file', 'error'); }
    }

    (host.querySelector('#btnDirectory') as HTMLElement).onclick = openDirectoryManager;

    (host.querySelector('#btnPrint') as HTMLElement).onclick = () => {
      const wasEdit = host.classList.contains('edit-mode');
      if (wasEdit) host.classList.remove('edit-mode');
      setTimeout(() => { window.print(); if (wasEdit) { setTimeout(() => host.classList.add('edit-mode'), 200); setTimeout(drawLines, 300); } }, 100);
    };

    (host.querySelector('#btnPng') as HTMLElement).onclick = async () => {
      showStatus('Generating PNG...', 'info', 1500);
      try {
        if (!(window as any).html2canvas) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.onload = () => resolve(); s.onerror = reject; document.head.appendChild(s);
          });
        }
        const wasEdit = host.classList.contains('edit-mode');
        if (wasEdit) host.classList.remove('edit-mode');
        await new Promise(r => setTimeout(r, 100)); drawLines(); await new Promise(r => setTimeout(r, 100));
        const canvas = await (window as any).html2canvas(host.querySelector('#canvas'), { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
        canvas.toBlob((blob: Blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${(state.title || 'organigram').replace(/[^a-z0-9_-]+/gi, '_')}.png`; a.click(); URL.revokeObjectURL(url); showStatus('PNG exported', 'success'); });
        if (wasEdit) host.classList.add('edit-mode');
      } catch { showStatus('PNG export unavailable. Use Print → Save as PDF instead.', 'error', 5000); }
    };

    // ── Settings ──────────────────────────────────────────

    (host.querySelector('#btnSettings') as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      (host.querySelector('#settingsPop') as HTMLElement).classList.toggle('open');
    };
    document.addEventListener('click', settingsOutsideClick);
    function settingsOutsideClick(e: Event) {
      const sp = host.querySelector('#settingsPop') as HTMLElement;
      const bs = host.querySelector('#btnSettings') as HTMLElement;
      if (sp && bs && !sp.contains(e.target as Node) && e.target !== bs) sp.classList.remove('open');
    }

    ['optShowSideRoles', 'optShowCoordinators', 'optShowTeamLabels', 'optShowBottom'].forEach(id => {
      const el = host.querySelector('#' + id) as HTMLInputElement;
      if (!el) return;
      el.addEventListener('change', e => {
        const key = id.replace('opt', ''); const k = key.charAt(0).toLowerCase() + key.slice(1);
        state.options[k] = (e.target as HTMLInputElement).checked;
        renderAll(); triggerSave();
      });
    });

    host.querySelectorAll('#settingsPop input[data-zone]').forEach(cb => {
      cb.addEventListener('change', e => {
        const zone  = (e.target as HTMLElement).dataset['zone']!;
        const field = (e.target as HTMLElement).dataset['field']!;
        state.options[zone + 'Contact'][field] = (e.target as HTMLInputElement).checked;
        renderAll(); triggerSave();
      });
    });

    // ── Add controls ──────────────────────────────────────

    (host.querySelector('#addCoordBtn') as HTMLElement).onclick = () => {
      state.coordinators.push({ title: 'New Coordinator', name: '(Name)', post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid' });
      renderAll(); triggerSave();
    };
    (host.querySelector('#addCoordDirBtn') as HTMLElement).onclick = () => {
      openDirectoryPicker((entry: any) => {
        const p = entryToPerson(entry);
        state.coordinators.push({ title: 'New Coordinator', name: p.name, post: p.post, photo: p.photo, email: p.email, phone: p.phone, dirId: p.dirId, side: 'right', lineStyle: 'solid' });
        renderAll(); triggerSave();
      });
    };
    (host.querySelector('#addWpBtn') as HTMLElement).onclick = () => {
      const n = state.workPackages.length + 1;
      state.workPackages.push({ id: 'WP' + n, title: 'New Work Package', leads: [mkPerson('(Lead)')], members: [], team: { label: 'New Team', members: [] } });
      renderAll(); triggerSave();
    };
    (host.querySelector('#addBottomBtn') as HTMLElement).onclick = () => {
      state.bottomRoles.push({ role: 'New Role', name: '(Name)' });
      renderAll(); triggerSave();
    };

    // ── Modal backdrop ────────────────────────────────────

    (host.querySelector('#modalBackdrop') as HTMLElement).addEventListener('click', e => {
      if (e.target === host.querySelector('#modalBackdrop')) closeModal();
    });
    document.addEventListener('keydown', escHandler);
    function escHandler(e: KeyboardEvent) {
      if (e.key === 'Escape' && host.querySelector('#modalBackdrop')?.classList.contains('open')) closeModal();
    }

    // ── Resize listener ───────────────────────────────────

    window.addEventListener('resize', drawLines);

    // ── Expose cleanup ────────────────────────────────────

    (window as any).__orgAppCleanup = () => {
      document.removeEventListener('click', settingsOutsideClick);
      document.removeEventListener('keydown', escHandler);
      window.removeEventListener('resize', drawLines);
      delete (window as any).__orgGetState;
      delete (window as any).__orgAppCleanup;
    };

    // ── Boot! ─────────────────────────────────────────────

    loadDirectory();
    state = normalizeState(state);
    bindEditableHandlers();
    renderAll();
  }
}
