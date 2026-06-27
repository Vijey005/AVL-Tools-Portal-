import {
 Component, Input, Output, EventEmitter, OnInit, signal, computed,
 ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DirectoryEntry, initials, genId } from '../../models/organigram.models';
import { DirectoryStorageService } from '../../services/directory-storage.service';
import { ExportService } from '../../services/export.service';
import { JoinPipe } from '../../pipes/join.pipe';

export type DirectoryModalMode = 'manager' | 'picker';

@Component({
 selector: 'app-org-directory-modal',
 standalone: true,
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [CommonModule, FormsModule, JoinPipe],
 templateUrl: './directory-modal.component.html',
 styleUrls: ['./directory-modal.component.css'],
})
export class DirectoryModalComponent implements OnInit {
 @Input() isOpen = false;
 @Input() mode: DirectoryModalMode = 'manager';

 @Output() close  = new EventEmitter<void>();
 @Output() picked  = new EventEmitter<DirectoryEntry>();

 // Internal view: 'list' | 'editor'
 view = signal<'list' | 'editor'>('list');

 filterText = signal('');
 editingEntry = signal<DirectoryEntry | null>(null);
 isNew    = signal(true);

 // Draft for editor
 draft = signal<DirectoryEntry>({ id: '', name: '', post: '', email: '', phone: '', photo: '' });

 entries$ = computed(() => {
  const f = this.filterText().trim().toLowerCase();
  return this.dirStorage.snapshot
   .filter(e =>
    !f ||
    (e.name || '').toLowerCase().includes(f) ||
    (e.post || '').toLowerCase().includes(f) ||
    (e.email || '').toLowerCase().includes(f)
   )
   .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
 });

 get dirCount(): number { return this.dirStorage.snapshot.length; }

 constructor(
  public dirStorage: DirectoryStorageService,
  private exportSvc: ExportService,
 ) {}

 ngOnInit(): void {}

 initials(name: string): string { return initials(name); }

 onBackdropClick(): void { this.close.emit(); }

 // ── List mode ─────────────────────────────────────────────

 pick(entry: DirectoryEntry): void {
  if (this.mode !== 'picker') return;
  this.picked.emit(entry);
  this.close.emit();
 }

 openEditor(entry: DirectoryEntry | null = null): void {
  this.isNew.set(!entry);
  const d = entry
   ? { ...entry }
   : { id: genId(), name: '', post: '', email: '', phone: '', photo: '' };
  this.draft.set(d);
  this.view.set('editor');
 }

 deleteEntry(entry: DirectoryEntry): void {
  if (!confirm(`Remove "${entry.name}" from the directory?`)) return;
  this.dirStorage.deleteEntry(entry.id).subscribe();
 }

 // ── Editor ────────────────────────────────────────────────

 updateDraft(partial: Partial<DirectoryEntry>): void {
  this.draft.update(d => ({ ...d, ...partial }));
 }

 async uploadPhoto(): Promise<void> {
  const photo = await this.exportSvc.pickAndResizePhoto(200);
  if (photo) this.updateDraft({ photo });
 }

 removePhoto(): void { this.updateDraft({ photo: '' }); }

 saveEntry(): void {
  const d = this.draft();
  if (!d.name.trim()) return;
  const toSave = { ...d, name: d.name.trim() };
  if (this.isNew()) {
   this.dirStorage.addEntry(toSave).subscribe();
  } else {
   this.dirStorage.updateEntry(toSave).subscribe();
  }
  this.view.set('list');
 }

 deleteEditing(): void {
  const d = this.draft();
  if (!confirm(`Remove "${d.name}" from the directory?`)) return;
  this.dirStorage.deleteEntry(d.id).subscribe();
  this.view.set('list');
 }

 // ── Import / Export ───────────────────────────────────────

 importDirectory(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
   const file = input.files?.[0];
   if (!file) return;
   try {
    const text = await file.text();
    const data = JSON.parse(text);
    let entries: any[] = [];
    if (Array.isArray(data)) entries = data;
    else if (data && Array.isArray(data.entries)) entries = data.entries;
    else { alert('Unrecognized directory format'); return; }

    const mode = confirm(
     `Import ${entries.length} entries.\n\nOK = MERGE into existing.\nCancel = REPLACE existing.`
    ) ? 'merge' : 'replace';

    this.dirStorage.importEntries(entries as DirectoryEntry[], mode).subscribe();
   } catch { alert('Invalid JSON file'); }
  };
  input.click();
 }

 exportDirectory(): void { this.dirStorage.exportAsJson(); }

 shareDirectory(): void {
  const email = prompt('Enter recipient email to share the directory:');
  if (!email) return;
  this.dirStorage.shareWith(email).subscribe({
   next: () => alert('Directory shared successfully!'),
   error: () => alert('Share failed. Check the email and try again.'),
  });
 }
}
