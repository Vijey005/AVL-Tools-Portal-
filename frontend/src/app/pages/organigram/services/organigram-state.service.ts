// ============================================================
// OrganigramStateService
// Signals-based reactive state container scoped to the
// organigram feature. Provided at component level (not root).
// ============================================================

import { Injectable, signal, computed } from '@angular/core';
import {
  OrganigramState, OrganigramOptions, Coordinator, WorkPackage,
  SideRole, BottomRole, Person, SvgPath,
  mkPerson, DEFAULT_STATE, normalizeState, blankState,
} from '../models/organigram.models';

@Injectable()
export class OrganigramStateService {

  // ── Core reactive signals ──────────────────────────────────
  readonly state    = signal<OrganigramState>(normalizeState(DEFAULT_STATE));
  readonly isEditMode = signal<boolean>(true);
  readonly svgPaths   = signal<SvgPath[]>([]);

  // ── Derived ───────────────────────────────────────────────
  readonly showSideRoles    = computed(() => this.state().options.showSideRoles);
  readonly showCoordinators = computed(() => this.state().options.showCoordinators);
  readonly showTeamLabels   = computed(() => this.state().options.showTeamLabels);
  readonly showBottom       = computed(() => this.state().options.showBottom);
  readonly coordsLeft       = computed(() => this.state().coordinators.filter(c => c.side === 'left'));
  readonly coordsRight      = computed(() => this.state().coordinators.filter(c => c.side === 'right'));

  // ── State loaders ─────────────────────────────────────────

  loadState(raw: any): void {
    this.state.set(normalizeState(raw));
  }

  resetToBlank(): void {
    this.state.set(blankState());
  }

  // ── Immutable updater helper ───────────────────────────────

  private update(fn: (s: OrganigramState) => OrganigramState): void {
    this.state.update(fn);
  }

  private patch(partial: Partial<OrganigramState>): void {
    this.update(s => ({ ...s, ...partial }));
  }

  // ── Title / Header ────────────────────────────────────────

  setTitle(v: string): void    { this.patch({ title: v }); }
  setSubtitle(v: string): void { this.patch({ subtitle: v }); }
  setPmTitle(v: string): void  { this.update(s => ({ ...s, pm: { ...s.pm, title: v } })); }
  setPmName(v: string): void   { this.update(s => ({ ...s, pm: { ...s.pm, name:  v } })); }

  // ── Side Roles ────────────────────────────────────────────

  addSideRole(): void {
    this.update(s => ({ ...s, sideRoles: [...s.sideRoles, { name: 'New Person', role: 'Role' }] }));
  }

  removeSideRole(idx: number): void {
    this.update(s => ({ ...s, sideRoles: s.sideRoles.filter((_, i) => i !== idx) }));
  }

  updateSideRole(idx: number, field: keyof SideRole, value: string): void {
    this.update(s => {
      const roles = [...s.sideRoles];
      roles[idx] = { ...roles[idx], [field]: value };
      return { ...s, sideRoles: roles };
    });
  }

  // ── Coordinators ──────────────────────────────────────────

  addCoordinator(): void {
    const c: Coordinator = { title: 'New Coordinator', name: '(Name)', post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid' };
    this.update(s => ({ ...s, coordinators: [...s.coordinators, c] }));
  }

  addCoordinatorFromEntry(entry: any): void {
    const c: Coordinator = { title: 'New Coordinator', name: entry.name, post: entry.post, photo: entry.photo, email: entry.email, phone: entry.phone, dirId: entry.id, side: 'right', lineStyle: 'solid' };
    this.update(s => ({ ...s, coordinators: [...s.coordinators, c] }));
  }

  removeCoordinator(idx: number): void {
    this.update(s => ({ ...s, coordinators: s.coordinators.filter((_, i) => i !== idx) }));
  }

  updateCoordinator(idx: number, partial: Partial<Coordinator>): void {
    this.update(s => {
      const list = [...s.coordinators];
      list[idx] = { ...list[idx], ...partial };
      return { ...s, coordinators: list };
    });
  }

  toggleCoordSide(idx: number): void {
    this.updateCoordinator(idx, { side: this.state().coordinators[idx].side === 'left' ? 'right' : 'left' });
  }

  toggleCoordLine(idx: number): void {
    this.updateCoordinator(idx, { lineStyle: this.state().coordinators[idx].lineStyle === 'dashed' ? 'solid' : 'dashed' });
  }

  // ── Work Packages ─────────────────────────────────────────

  addWorkPackage(): void {
    const n = this.state().workPackages.length + 1;
    const wp: WorkPackage = { id: 'WP' + n, title: 'New Work Package', leads: [mkPerson('(Lead)')], members: [], team: { label: 'New Team', members: [] } };
    this.update(s => ({ ...s, workPackages: [...s.workPackages, wp] }));
  }

  removeWorkPackage(idx: number): boolean {
    if (this.state().workPackages.length <= 1) return false;
    this.update(s => ({ ...s, workPackages: s.workPackages.filter((_, i) => i !== idx) }));
    return true;
  }

  updateWorkPackage(idx: number, partial: Partial<WorkPackage>): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[idx] = { ...wps[idx], ...partial };
      return { ...s, workPackages: wps };
    });
  }

  // WP leads
  addWpLead(wpIdx: number, person: Person = mkPerson('New Lead')): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], leads: [...wps[wpIdx].leads, person] };
      return { ...s, workPackages: wps };
    });
  }

  removeWpLead(wpIdx: number, personIdx: number): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], leads: wps[wpIdx].leads.filter((_, i) => i !== personIdx) };
      return { ...s, workPackages: wps };
    });
  }

  updateWpLead(wpIdx: number, personIdx: number, partial: Partial<Person>): void {
    this.update(s => {
      const wps = [...s.workPackages];
      const leads = [...wps[wpIdx].leads];
      leads[personIdx] = { ...leads[personIdx], ...partial };
      wps[wpIdx] = { ...wps[wpIdx], leads };
      return { ...s, workPackages: wps };
    });
  }

  // WP members
  addWpMember(wpIdx: number, person: Person = mkPerson('New Position')): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], members: [...wps[wpIdx].members, person] };
      return { ...s, workPackages: wps };
    });
  }

  removeWpMember(wpIdx: number, personIdx: number): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], members: wps[wpIdx].members.filter((_, i) => i !== personIdx) };
      return { ...s, workPackages: wps };
    });
  }

  updateWpMember(wpIdx: number, personIdx: number, partial: Partial<Person>): void {
    this.update(s => {
      const wps = [...s.workPackages];
      const members = [...wps[wpIdx].members];
      members[personIdx] = { ...members[personIdx], ...partial };
      wps[wpIdx] = { ...wps[wpIdx], members };
      return { ...s, workPackages: wps };
    });
  }

  // WP team
  updateTeamLabel(wpIdx: number, label: string): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], team: { ...wps[wpIdx].team, label } };
      return { ...s, workPackages: wps };
    });
  }

  addTeamMember(wpIdx: number, person: Person = mkPerson('New Position')): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], team: { ...wps[wpIdx].team, members: [...wps[wpIdx].team.members, person] } };
      return { ...s, workPackages: wps };
    });
  }

  removeTeamMember(wpIdx: number, memberIdx: number): void {
    this.update(s => {
      const wps = [...s.workPackages];
      wps[wpIdx] = { ...wps[wpIdx], team: { ...wps[wpIdx].team, members: wps[wpIdx].team.members.filter((_, i) => i !== memberIdx) } };
      return { ...s, workPackages: wps };
    });
  }

  updateTeamMember(wpIdx: number, memberIdx: number, partial: Partial<Person>): void {
    this.update(s => {
      const wps = [...s.workPackages];
      const members = [...wps[wpIdx].team.members];
      members[memberIdx] = { ...members[memberIdx], ...partial };
      wps[wpIdx] = { ...wps[wpIdx], team: { ...wps[wpIdx].team, members } };
      return { ...s, workPackages: wps };
    });
  }

  // ── Bottom Roles ──────────────────────────────────────────

  addBottomRole(): void {
    this.update(s => ({ ...s, bottomRoles: [...s.bottomRoles, { role: 'New Role', name: '(Name)' }] }));
  }

  removeBottomRole(idx: number): void {
    this.update(s => ({ ...s, bottomRoles: s.bottomRoles.filter((_, i) => i !== idx) }));
  }

  updateBottomRole(idx: number, field: keyof BottomRole, value: string): void {
    this.update(s => {
      const roles = [...s.bottomRoles];
      roles[idx] = { ...roles[idx], [field]: value };
      return { ...s, bottomRoles: roles };
    });
  }

  // ── Options ───────────────────────────────────────────────

  updateOptions(partial: Partial<OrganigramOptions>): void {
    this.update(s => ({ ...s, options: { ...s.options, ...partial } }));
  }

  updateContactOption(zone: 'coord' | 'wp' | 'team', field: 'photo' | 'post' | 'email' | 'phone', value: boolean): void {
    const key = (zone + 'Contact') as 'coordContact' | 'wpContact' | 'teamContact';
    this.update(s => ({
      ...s,
      options: {
        ...s.options,
        [key]: { ...s.options[key], [field]: value },
      },
    }));
  }

  // ── Photo helpers ─────────────────────────────────────────

  setCoordinatorPhoto(idx: number, photo: string): void  { this.updateCoordinator(idx, { photo }); }
  setWpLeadPhoto(wpIdx: number, pIdx: number, photo: string): void  { this.updateWpLead(wpIdx, pIdx, { photo }); }
  setWpMemberPhoto(wpIdx: number, pIdx: number, photo: string): void  { this.updateWpMember(wpIdx, pIdx, { photo }); }
  setTeamMemberPhoto(wpIdx: number, pIdx: number, photo: string): void  { this.updateTeamMember(wpIdx, pIdx, { photo }); }
}
