// ============================================================
// DirectoryStorageService
// Stores the People Directory as a dedicated API file record.
// tool_type = 'organigram_directory'
//
// This enables:
//  - Per-user server-side storage (no localStorage dependency)
//  - Download via JSON export (exportDirectory)
//  - Share via existing ApiService.shareFile(id, email)
// ============================================================

import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { DirectoryEntry, genId } from '../models/organigram.models';
import { ApiService } from '../../../services/api.service';

const TOOL_TYPE = 'organigram_directory';
const DIR_FILENAME = 'Team Directory';

@Injectable()
export class DirectoryStorageService {

  private entries$ = new BehaviorSubject<DirectoryEntry[]>([]);
  private fileId: number | null = null;

  /** Observable list of entries for components to subscribe to */
  readonly entries = this.entries$.asObservable();

  get snapshot(): DirectoryEntry[] { return this.entries$.value; }

  constructor(private api: ApiService) {}

  // ── Load from API ─────────────────────────────────────────

  /**
   * On app start, look for an existing directory file in the API.
   * If none exists, create one. This is called once from OrganigramComponent.
   */
  init(): Observable<DirectoryEntry[]> {
    return this.api.getFiles(TOOL_TYPE).pipe(
      switchMap((files: any[]) => {
        if (files && files.length > 0) {
          const dirFile = files[0];
          this.fileId = dirFile.id;
          return of(dirFile.json_payload);
        } else {
          // Create a blank directory file
          return this.api.createFile({
            tool_type: TOOL_TYPE,
            name: DIR_FILENAME,
            json_payload: JSON.stringify({ version: 1, entries: [] }),
          }).pipe(
            tap((created: any) => { this.fileId = created.id; }),
            map(() => JSON.stringify({ version: 1, entries: [] }))
          );
        }
      }),
      map((payloadStr: string) => {
        try {
          const data = JSON.parse(payloadStr);
          const normalized: DirectoryEntry[] = Array.isArray(data.entries)
            ? data.entries.map((e: any) => ({
                id:    e.id    || genId(),
                name:  e.name  || '',
                post:  e.post  || '',
                email: e.email || '',
                phone: e.phone || '',
                photo: e.photo || '',
              }))
            : [];
          this.entries$.next(normalized);
          return normalized;
        } catch {
          this.entries$.next([]);
          return [];
        }
      }),
      catchError(() => {
        this.entries$.next([]);
        return of([]);
      })
    );
  }

  // ── Persist to API ────────────────────────────────────────

  private persist(): Observable<any> {
    if (this.fileId === null) return of(null);
    const payload = JSON.stringify({ version: 1, entries: this.entries$.value });
    return this.api.updateFile(this.fileId, { json_payload: payload });
  }

  // ── CRUD ─────────────────────────────────────────────────

  addEntry(entry: Omit<DirectoryEntry, 'id'>): Observable<DirectoryEntry> {
    const newEntry: DirectoryEntry = { id: genId(), ...entry };
    this.entries$.next([...this.entries$.value, newEntry]);
    return this.persist().pipe(map(() => newEntry));
  }

  updateEntry(updated: DirectoryEntry): Observable<DirectoryEntry> {
    const list = this.entries$.value.map(e => e.id === updated.id ? updated : e);
    this.entries$.next(list);
    return this.persist().pipe(map(() => updated));
  }

  deleteEntry(id: string): Observable<void> {
    this.entries$.next(this.entries$.value.filter(e => e.id !== id));
    return this.persist().pipe(map(() => void 0));
  }

  // ── Import (merge or replace) ─────────────────────────────

  importEntries(incoming: DirectoryEntry[], mode: 'merge' | 'replace'): Observable<DirectoryEntry[]> {
    const normalized = incoming.map(e => ({ ...e, id: genId() })).filter(e => e.name);
    const result = mode === 'replace' ? normalized : [...this.entries$.value, ...normalized];
    this.entries$.next(result);
    return this.persist().pipe(map(() => result));
  }

  // ── Export (JSON download) ────────────────────────────────

  exportAsJson(): void {
    const json = JSON.stringify({ version: 1, entries: this.entries$.value }, null, 2);
    const fileName = `team_directory_${new Date().toISOString().slice(0, 10)}.json`;
    this.triggerDownload(json, fileName, 'application/json');
  }

  // ── Share via API ─────────────────────────────────────────

  shareWith(recipientEmail: string): Observable<any> {
    if (this.fileId === null) return of(null);
    return this.api.shareFile(this.fileId, recipientEmail);
  }

  // ── Helpers ───────────────────────────────────────────────

  findById(id: string): DirectoryEntry | undefined {
    return this.entries$.value.find(e => e.id === id);
  }

  private triggerDownload(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }
}
