// ============================================================
// AVL Organigram Creator — TypeScript Models & Default State
// ============================================================

export interface Person {
 name: string;
 post: string;
 photo: string;  // base64 data URL or ''
 email: string;
 phone: string;
 dirId: string;  // reference to a DirectoryEntry.id, or ''
}

export interface DirectoryEntry {
 id: string;
 name: string;
 post: string;
 email: string;
 phone: string;
 photo: string;
}

export interface Coordinator extends Person {
 title: string;
 side: 'left' | 'right';
 lineStyle: 'solid' | 'dashed';
}

export interface WorkPackage {
 id: string;
 title: string;
 leads: Person[];
 members: Person[];
 team: {
  label: string;
  members: Person[];
 };
}

export interface SideRole {
 name: string;
 role: string;
}

export interface BottomRole {
 role: string;
 name: string;
}

export interface ContactOptions {
 photo: boolean;
 post: boolean;
 email: boolean;
 phone: boolean;
}

export interface OrganigramOptions {
 showSideRoles: boolean;
 showCoordinators: boolean;
 showTeamLabels: boolean;
 showBottom: boolean;
 coordContact: ContactOptions;
 wpContact: ContactOptions;
 teamContact: ContactOptions;
}

export interface OrganigramState {
 title: string;
 subtitle: string;
 sideRoles: SideRole[];
 pm: { title: string; name: string };
 coordinators: Coordinator[];
 workPackages: WorkPackage[];
 bottomRoles: BottomRole[];
 options: OrganigramOptions;
}

/** A computed SVG path descriptor for declarative template binding */
export interface SvgPath {
 d: string;
 dashed: boolean;
}

// ============================================================
// Helpers
// ============================================================

export function mkPerson(name = ''): Person {
 return { name, post: '', photo: '', email: '', phone: '', dirId: '' };
}

export function toPerson(v: any): Person {
 if (v && typeof v === 'object') {
  return {
   name: v.name || '',
   post: v.post || '',
   photo: v.photo || '',
   email: v.email || '',
   phone: v.phone || '',
   dirId: v.dirId || '',
  };
 }
 return mkPerson(String(v || ''));
}

export function entryToPerson(entry: DirectoryEntry): Person {
 return {
  name: entry.name || '',
  post: entry.post || '',
  photo: entry.photo || '',
  email: entry.email || '',
  phone: entry.phone || '',
  dirId: entry.id  || '',
 };
}

export function genId(): string {
 return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function initials(name = ''): string {
 const parts = String(name).split(/\s+/).filter(Boolean);
 if (!parts.length) return '?';
 if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
 return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================
// Default State
// ============================================================

const defaultContactOpts: ContactOptions = { photo: false, post: false, email: false, phone: false };

export const DEFAULT_STATE: OrganigramState = {
 title:  'REx Project',
 subtitle: 'Project team AVL',
 sideRoles: [
  { name: 'Gerald Mair',  role: 'Project Coordination' },
  { name: 'Sylvain Joyeux', role: 'Project director AVL LMM' },
  { name: 'Yassine DILOO', role: 'TCM' },
  { name: 'Rene Muller',  role: 'KAM' },
 ],
 pm: { title: 'Project Manager', name: 'Sebastien Dulphy' },
 coordinators: [
  { title: 'Technical product manager',   name: 'Haarith Mukundan',    post: '', photo: '', email: '', phone: '', dirId: '', side: 'left', lineStyle: 'dashed' },
  { title: 'Technical Leader',       name: 'Morgan Guillochin (TBC)', post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid' },
  { title: 'Global Technical Coordination', name: '(Name)',         post: '', photo: '', email: '', phone: '', dirId: '', side: 'right', lineStyle: 'solid' },
 ],
 workPackages: [
  { id: 'WP1', title: 'HEVC Systems',     leads: [mkPerson('Thomas Carayol')],                   members: [], team: { label: 'Systems Team',       members: [] } },
  { id: 'WP2', title: 'SW ASW Development',  leads: [mkPerson('Lucas Monteil')],                    members: [], team: { label: 'SW Team',          members: [] } },
  { id: 'WP3', title: 'PWT Integration',    leads: [mkPerson('Bruno Serre (HW)'), mkPerson('Daniel Cabrita (EE)')], members: [], team: { label: 'Design & Integration Team', members: [] } },
  { id: 'WP4', title: 'Tuning & testing',   leads: [mkPerson('Arnaud Etheve')],                    members: [], team: { label: 'Tuning & Testing Team',   members: [] } },
 ],
 bottomRoles: [
  { role: 'Design Lead Engineer', name: 'Bruno Tedde' },
  { role: 'Systems Lead Engineer', name: 'Thomas Adan' },
  { role: 'EDU Product Manager',  name: 'Quentin Bassi' },
  { role: 'ICE Product Manager',  name: 'Benjamin Moulene' },
 ],
 options: {
  showSideRoles:  true,
  showCoordinators: true,
  showTeamLabels:  true,
  showBottom:    true,
  coordContact: { ...defaultContactOpts },
  wpContact:  { ...defaultContactOpts },
  teamContact: { ...defaultContactOpts },
 },
};

// ============================================================
// State Normalizer — handles old formats & missing fields
// ============================================================

export function normalizeState(data: any): OrganigramState {
 const d: any = JSON.parse(JSON.stringify(data || {}));
 const def = DEFAULT_STATE;

 if (typeof d.title  !== 'string') d.title  = '';
 if (typeof d.subtitle !== 'string') d.subtitle = '';
 if (!Array.isArray(d.sideRoles)) d.sideRoles = [];
 if (!d.pm) d.pm = { ...def.pm };

 // Migration: old format used tpm/tl separate keys
 if (!Array.isArray(d.coordinators)) {
  d.coordinators = [];
  if (d.tpm) d.coordinators.push({ title: d.tpm.title || '', name: d.tpm.name || '', side: 'left', lineStyle: 'dashed' });
  if (d.tl) d.coordinators.push({ title: d.tl.title || '', name: d.tl.name || '', side: 'right', lineStyle: 'solid' });
 }
 delete d.tpm; delete d.tl;

 d.coordinators = d.coordinators.map((c: any): Coordinator => ({
  title:   c.title   || '',
  name:   c.name   || '',
  post:   c.post   || '',
  photo:   c.photo   || '',
  email:   c.email   || '',
  phone:   c.phone   || '',
  dirId:   c.dirId   || '',
  side:   c.side === 'right' ? 'right' : 'left',
  lineStyle: c.lineStyle === 'dashed' ? 'dashed' : 'solid',
 }));

 if (!Array.isArray(d.workPackages) || !d.workPackages.length) {
  d.workPackages = JSON.parse(JSON.stringify(def.workPackages));
 }

 d.workPackages = d.workPackages.map((wp: any): WorkPackage => {
  const leads  = Array.isArray(wp.leads)  ? wp.leads.map(toPerson)  : [];
  const members = Array.isArray(wp.members) ? wp.members.map(toPerson) : [];
  const teamMembers = wp.team && Array.isArray(wp.team.members) ? wp.team.members.map(toPerson) : [];
  return {
   id:  wp.id  || 'WP?',
   title: wp.title || '',
   leads:  leads.length  ? leads  : [mkPerson('(Lead)')],
   members,
   team: {
    label:  (wp.team && wp.team.label) || wp.teamLabel || '',
    members: teamMembers,
   },
  };
 });

 if (!Array.isArray(d.bottomRoles)) d.bottomRoles = [];

 const defOpts = def.options;
 const o: any = Object.assign({}, defOpts, d.options || {});
 o.coordContact = Object.assign({}, defOpts.coordContact, (d.options || {}).coordContact || {});
 o.wpContact  = Object.assign({}, defOpts.wpContact,  (d.options || {}).wpContact  || {});
 o.teamContact = Object.assign({}, defOpts.teamContact, (d.options || {}).teamContact || {});
 d.options = o;

 return d as OrganigramState;
}

/** Create a minimal blank state for "New Chart" */
export function blankState(): OrganigramState {
 return normalizeState({
  title:  'New Project',
  subtitle: 'Project team',
  pm: { title: 'Project Manager', name: '(Name)' },
  coordinators: [],
  workPackages: [{ id: 'WP1', title: 'Work Package 1', leads: [mkPerson('(Lead)')], members: [], team: { label: 'Team 1', members: [] } }],
  sideRoles: [],
  bottomRoles: [],
  options: JSON.parse(JSON.stringify(DEFAULT_STATE.options)),
 });
}
