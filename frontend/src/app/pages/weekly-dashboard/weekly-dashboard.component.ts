import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
// @ts-ignore
import { saveAs } from 'file-saver';

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
 loadError = '';
 saving: boolean = false;
 hasUnsavedChanges = false;
 
 deletingRowId: string | null = null;
 deletingWeek: boolean = false;
 
 private saveSubject = new Subject<void>();
 private sub!: Subscription;

 constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

 ngOnInit() {
  this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
  this.api.getFile(this.fileId).subscribe({
   next: (file) => {
    this.fileName = file.name;
    this.parsePayload(file.json_payload);
    this.loading = false;
   },
   error: (err) => {
    this.loadError = err.error?.detail || 'Failed to load dashboard.';
    this.loading = false;
   }
  });

  // Auto-save debouncer
  this.sub = this.saveSubject.pipe(debounceTime(1500)).subscribe(() => {
   if (this.hasUnsavedChanges) {
     this.performSave();
   }
  });
 }

 ngOnDestroy() {
  if (this.hasUnsavedChanges) {
    this.performSave();
  }
  this.saveSubject.complete();
  this.sub?.unsubscribe();
 }

 @HostListener('window:beforeunload', ['$event'])
 unloadNotification($event: any) {
  if (this.hasUnsavedChanges) {
   this.performSave();
  }
 }

 parsePayload(payloadStr: string) {
  try {
   this.state = JSON.parse(payloadStr);
   if (!this.state.snapshots) this.initEmptyState();
   
   // Ensure current week exists if state loaded without it
   const currentWeek = this.getCurrentWeek();
   if (!this.state.snapshots.find(s => s.week === currentWeek) && !this.state.activeWeek) {
    this.state.activeWeek = currentWeek;
    this.state.snapshots.push({
     week: currentWeek,
     savedAt: new Date().toISOString(),
     globalTrajMode: 'auto',
     globalTrajManual: 1,
     rows: []
    });
   }
   
   if (!this.state.activeWeek) {
     this.state.activeWeek = this.state.snapshots[0]?.week || this.getCurrentWeek();
   }

  } catch {
   this.initEmptyState();
  }
 }

 initEmptyState() {
  const w = this.getCurrentWeek();
  this.state = {
   _type: 'AVL_WeeklyDashboard',
   _version: 3,
   meta: { title: 'Weekly Dashboard', subtitle: 'Macro project indicators', author: '' },
   activeWeek: w,
   snapshots: [{
    week: w,
    savedAt: new Date().toISOString(),
    globalTrajMode: 'auto',
    globalTrajManual: 1,
    rows: []
   }]
  };
  this.triggerSave(true);
 }

 getCurrentWeek() {
  const d = new Date();
  const startDate = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil(days / 7);
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
 }
 
 getNextWeek(weekStr: string) {
  const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return this.getCurrentWeek();
  let y = +match[1], w = +match[2] + 1;
  if (w > 53) { w = 1; y++; }
  return `${y}-W${w.toString().padStart(2, '0')}`;
 }

 get activeSnapshot(): DashboardSnapshot {
  return this.state.snapshots.find(s => s.week === this.state.activeWeek) || this.state.snapshots[0];
 }

 triggerSave(immediate = false) {
  this.hasUnsavedChanges = true;
  if (immediate) {
    this.performSave();
  } else {
    this.saveSubject.next();
  }
 }

 performSave() {
  if (!this.state) return;
  this.saving = true;
  this.hasUnsavedChanges = false;
  const payload = JSON.stringify(this.state);
  
  if (this.state.meta && this.state.meta.title) {
   this.fileName = this.state.meta.title;
  } else {
   this.fileName = 'Untitled Dashboard';
  }

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
  this.triggerSave(true);
 }

 deleteRow(id: string) {
  if (this.deletingRowId === id) {
   this.activeSnapshot.rows = this.activeSnapshot.rows.filter(r => r.id !== id);
   this.deletingRowId = null;
   this.triggerSave(true);
  } else {
   this.deletingRowId = id;
   setTimeout(() => {
    if (this.deletingRowId === id) {
     this.deletingRowId = null;
    }
   }, 3000);
  }
 }

 cycleStatus(row: DashboardRow) {
  if (row.status === -1) row.status = 0;
  else row.status = (row.status + 1) % 3;
  this.triggerSave();
 }
 
 moveRowUp(index: number) {
   if (index > 0) {
     const rows = this.activeSnapshot.rows;
     [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
     this.triggerSave();
   }
 }

 moveRowDown(index: number) {
   const rows = this.activeSnapshot.rows;
   if (index < rows.length - 1) {
     [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
     this.triggerSave();
   }
 }

 // Snapshot Actions
 createNewWeek() {
  const nextWeek = this.getNextWeek(this.state.activeWeek);
  if (this.state.snapshots.find(s => s.week === nextWeek)) {
    this.state.activeWeek = nextWeek;
    return;
  }
  const currentSnap = this.activeSnapshot;
  const newSnap: DashboardSnapshot = {
    week: nextWeek,
    savedAt: new Date().toISOString(),
    globalTrajMode: currentSnap.globalTrajMode,
    globalTrajManual: currentSnap.globalTrajManual,
    rows: currentSnap.rows.map(r => ({ ...r, comments: '', status: -1, next: '' }))
  };
  this.state.snapshots.push(newSnap);
  this.state.activeWeek = nextWeek;
  this.triggerSave(true);
 }
 
 duplicateWeek() {
  const nextWeek = this.getNextWeek(this.state.activeWeek);
  if (this.state.snapshots.find(s => s.week === nextWeek)) {
    alert("Next week already exists.");
    return;
  }
  const currentSnap = this.activeSnapshot;
  const newSnap: DashboardSnapshot = JSON.parse(JSON.stringify(currentSnap));
  newSnap.week = nextWeek;
  newSnap.savedAt = new Date().toISOString();
  this.state.snapshots.push(newSnap);
  this.state.activeWeek = nextWeek;
  this.triggerSave(true);
 }

 deleteWeek() {
  if (this.state.snapshots.length <= 1) {
    alert("Cannot delete the only week snapshot.");
    return;
  }
  if (this.deletingWeek) {
    this.state.snapshots = this.state.snapshots.filter(s => s.week !== this.state.activeWeek);
    this.state.activeWeek = this.state.snapshots[this.state.snapshots.length - 1].week;
    this.deletingWeek = false;
    this.triggerSave(true);
  } else {
    this.deletingWeek = true;
    setTimeout(() => {
      this.deletingWeek = false;
    }, 3000);
  }
 }
 
 renameWeek() {
  const currentName = this.state.activeWeek;
  const newName = prompt('Enter new name for this snapshot:', currentName);
  if (newName && newName.trim() !== '' && newName !== currentName) {
   if (this.state.snapshots.find(s => s.week === newName)) {
    alert('A snapshot with this name already exists.');
    return;
   }
   const snap = this.activeSnapshot;
   snap.week = newName;
   this.state.activeWeek = newName;
   this.triggerSave(true);
  }
 }

 changeWeek(week: string) {
   this.state.activeWeek = week;
   this.triggerSave();
 }

 // Import / Export
 onImportJson(event: any) {
  const file = event.target.files[0];
  if (file) {
   const reader = new FileReader();
   reader.onload = (e: any) => {
    try {
     const importedState = JSON.parse(e.target.result);
     if (importedState._type === 'AVL_WeeklyDashboard') {
      this.state = importedState;
      this.triggerSave(true);
     } else {
      alert('Invalid JSON file format.');
     }
    } catch (err) {
     alert('Error parsing JSON file.');
    }
   };
   reader.readAsText(file);
  }
  event.target.value = '';
 }

 exportJson() {
  const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
  saveAs(blob, `${this.state.meta.title || 'Dashboard'}_${this.state.activeWeek}.json`);
 }

 onImportExcel(event: any) {
  const file = event.target.files[0];
  if (file) {
   const reader = new FileReader();
   reader.onload = (e: any) => {
    try {
     const data = new Uint8Array(e.target.result);
     const workbook = XLSX.read(data, { type: 'array' });
     const firstSheetName = workbook.SheetNames[0];
     const worksheet = workbook.Sheets[firstSheetName];
     const json = XLSX.utils.sheet_to_json<any>(worksheet);
     
     if (json && json.length > 0) {
      const snap = this.activeSnapshot;
      snap.rows = json.map((row: any) => ({
       id: Math.random().toString(36).substring(2, 9),
       item: row.Item || row.item || 'Imported item',
       weight: Number(row.Weight) || 1,
       comments: row.Comments || row.comments || '',
       status: this.parseExcelStatus(row.Status || row.status),
       traj: row.Trajectory !== undefined ? Number(row.Trajectory) : -1,
       next: row.NextSteps || row.next || ''
      }));
      this.triggerSave(true);
     }
    } catch (err) {
     console.error(err);
     alert('Error parsing Excel file.');
    }
   };
   reader.readAsArrayBuffer(file);
  }
  event.target.value = '';
 }
 
 parseExcelStatus(val: any): number {
  if (!val) return -1;
  const s = String(val).toLowerCase().trim();
  if (s.includes('on track') || s.includes('green')) return 2;
  if (s.includes('at risk') || s.includes('amber') || s.includes('yellow')) return 1;
  if (s.includes('off track') || s.includes('red')) return 0;
  return -1;
 }

 exportExcel() {
  const snap = this.activeSnapshot;
  const exportData = snap.rows.map(r => ({
   Item: r.item,
   Weight: r.weight,
   Comments: r.comments,
   Status: r.status === 2 ? 'On Track' : (r.status === 1 ? 'At Risk' : (r.status === 0 ? 'Off Track' : 'Unset')),
   Trajectory: r.traj !== -1 ? r.traj : '',
   NextSteps: r.next
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  const safeSheetName = snap.week.substring(0, 31).replace(/[\\/*?:\[\]]/g, '');
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName || 'Sheet1');
  XLSX.writeFile(workbook, `${this.state.meta.title || 'Dashboard'}_${snap.week}.xlsx`);
 }

 exportPdf() {
  const element = document.getElementById('dashboard-content');
  if (!element) return;
  
  element.classList.add('pdf-export-mode');
  
  html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#080c10' }).then((canvas: any) => {
   element.classList.remove('pdf-export-mode');
   const imgData = canvas.toDataURL('image/png');
   const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
   });
   pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
   pdf.save(`${this.state.meta.title || 'Dashboard'}_${this.state.activeWeek}.pdf`);
  });
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

 // Summary Metrics
 get onTrackCount(): number { return this.activeSnapshot.rows.filter(r => r.status === 2).length; }
 get atRiskCount(): number { return this.activeSnapshot.rows.filter(r => r.status === 1).length; }
 get offTrackCount(): number { return this.activeSnapshot.rows.filter(r => r.status === 0).length; }
 get totalWeight(): number { return this.activeSnapshot.rows.reduce((s, x) => s + (x.weight || 0), 0); }

 // UI Helpers
 getPointerPosition(val: number): string {
  if (val === -1 || val == null) return '50%';
  return `${16.6667 + val * 33.3333}%`;
 }

 goBack() {
  this.router.navigate(['/hub']);
 }
}
