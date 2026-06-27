import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ShareModalComponent } from '../../shared/share-modal/share-modal.component';

function currentWeek(): string {
 const d = new Date();
 const start = new Date(d.getFullYear(), 0, 1);
 const days = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
 const week = Math.ceil(days / 7);
 return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

@Component({
 selector: 'app-hub',
 standalone: true,
 imports: [CommonModule, ShareModalComponent],
 templateUrl: './hub.component.html',
 styleUrls: ['./hub.component.css']
})
export class HubComponent implements OnInit {
 files: any[] = [];
 myProjects: any[] = [];
 sharedWithMe: any[] = [];
 selectedToolType: string = '';
 activeTab: 'my-projects' | 'shared-with-me' = 'my-projects';
 loading = true;
 errorMsg = '';
 createError = '';

 isShareModalOpen = false;
 selectedFileId: number | null = null;
 deletingFileId: number | null = null;

 constructor(private api: ApiService, private router: Router) {}

 ngOnInit() {
  this.loadFiles();
 }

 loadFiles() {
  this.loading = true;
  this.errorMsg = '';
  this.api.getFiles(this.selectedToolType || undefined).subscribe({
   next: files => {
    this.files = files;
    this.myProjects = files.filter(f => !f.shared_by_user_id);
    this.sharedWithMe = files.filter(f => f.shared_by_user_id);
    this.loading = false;
   },
   error: err => {
    this.loading = false;
    this.errorMsg = err.error?.detail || 'Unable to load projects. Ensure the backend server is running.';
   }
  });
 }

 setTab(tab: 'my-projects' | 'shared-with-me') {
  this.activeTab = tab;
 }

 setFilter(type: string) {
  this.selectedToolType = type;
  this.loadFiles();
 }

 createNew(toolType: string) {
  this.createError = '';
  const week = currentWeek();
  const defaultPayloads: Record<string, string> = {
   lmm: JSON.stringify({ tasks: [], resources: [], projectName: 'New Project' }),
   organigram: JSON.stringify({ title: 'New Organigram', nodes: [] }),
   dashboard: JSON.stringify({
    _type: 'AVL_WeeklyDashboard',
    _version: 3,
    meta: { title: 'New Dashboard', subtitle: '', author: '' },
    activeWeek: week,
    snapshots: [{
     week,
     savedAt: new Date().toISOString(),
     globalTrajMode: 'auto',
     globalTrajManual: 1,
     rows: []
    }]
   })
  };

  const newFile = {
   tool_type: toolType,
   name: `Untitled ${this.getToolName(toolType)}`,
   json_payload: defaultPayloads[toolType]
  };

  this.api.createFile(newFile).subscribe({
   next: file => this.openFile(file.id, toolType),
   error: err => {
    this.createError = err.error?.detail || 'Failed to create project.';
   }
  });
 }

 openFile(id: number, toolType: string) {
  if (toolType === 'lmm') this.router.navigate(['/tools/lmm', id]);
  else if (toolType === 'organigram') this.router.navigate(['/tools/organigram', id]);
  else if (toolType === 'dashboard') this.router.navigate(['/tools/dashboard', id]);
 }

 deleteFile(id: number) {
  if (this.deletingFileId === id) {
   this.api.deleteFile(id).subscribe({
    next: () => {
     this.deletingFileId = null;
     this.loadFiles();
    },
    error: err => {
     this.deletingFileId = null;
     this.errorMsg = err.error?.detail || 'Failed to delete project.';
    }
   });
  } else {
   this.deletingFileId = id;
  }
 }

 cancelDelete() {
  this.deletingFileId = null;
 }

 openShareModal(id: number) {
  this.selectedFileId = id;
  this.isShareModalOpen = true;
 }

 closeShareModal() {
  this.isShareModalOpen = false;
  this.selectedFileId = null;
 }

 onShared() {
  this.closeShareModal();
  this.loadFiles();
 }

 getToolName(type: string) {
  return ({
   'lmm': 'LMM Planner',
   'organigram': 'Organigram',
   'dashboard': 'Dashboard'
  } as Record<string, string>)[type] || type;
 }
}
