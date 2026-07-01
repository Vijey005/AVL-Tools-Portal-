import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ShareModalComponent } from '../../shared/share-modal/share-modal.component';
import { Subscription, interval } from 'rxjs';

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
export class HubComponent implements OnInit, OnDestroy {
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

 private currentUserId: number | null = null;
 private pollingSub?: Subscription;
 private userSub?: Subscription;

 constructor(private api: ApiService, private authService: AuthService, private router: Router) {}

 ngOnInit() {
  this.userSub = this.authService.currentUser$.subscribe(user => {
   this.currentUserId = user?.id ?? null;
   if (this.currentUserId) {
    this.loadFiles(true);
   }
  });

  this.pollingSub = interval(3000).subscribe(() => {
   if (this.currentUserId) {
    this.pollFiles();
   }
  });
 }

 ngOnDestroy() {
  this.pollingSub?.unsubscribe();
  this.userSub?.unsubscribe();
 }

 private categorizeFiles(files: any[]) {
  if (!this.currentUserId) {
   this.myProjects = [];
   this.sharedWithMe = [];
   return;
  }
  this.myProjects = files.filter(f => f.owner_id === this.currentUserId);
  this.sharedWithMe = files.filter(f => f.owner_id !== this.currentUserId);
 }

 loadFiles(showLoading = false) {
  if (showLoading) {
   this.loading = true;
  }
  this.errorMsg = '';
  this.api.getFiles(this.selectedToolType || undefined).subscribe({
   next: files => {
    this.files = files;
    this.categorizeFiles(files);
    this.loading = false;
   },
   error: err => {
    this.loading = false;
    this.errorMsg = err.error?.detail || 'Unable to load projects. Ensure the backend server is running.';
   }
  });
 }

 pollFiles() {
  this.api.getFiles(this.selectedToolType || undefined).subscribe({
   next: files => {
    this.files = files;
    this.categorizeFiles(files);
    this.errorMsg = '';
   },
   error: () => {}
  });
 }

 setTab(tab: 'my-projects' | 'shared-with-me') {
  this.activeTab = tab;
 }

 setFilter(type: string) {
  this.selectedToolType = type;
  this.loadFiles(true);
 }

 createNew(toolType: string) {
  this.createError = '';
  const defaultName = `Untitled ${this.getToolName(toolType)}`;
  const projectName = window.prompt(`Enter a name for your new ${this.getToolName(toolType)}:`, defaultName);

  if (projectName === null) {
   return;
  }

  const finalName = projectName.trim() || defaultName;

  const week = currentWeek();
  const defaultPayloads: Record<string, string> = {
   lmm: JSON.stringify({ tasks: [], resources: [], projectName: finalName }),
   organigram: JSON.stringify({ title: finalName, nodes: [] }),
   dashboard: JSON.stringify({
    _type: 'AVL_WeeklyDashboard',
    _version: 3,
    meta: { title: finalName, subtitle: '', author: '' },
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
   name: finalName,
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

 renameFile(file: any) {
  const newName = window.prompt("Enter new project name:", file.name);
  if (newName === null) {
   return;
  }

  const finalName = newName.trim();
  if (!finalName || finalName === file.name) {
   return;
  }

  this.api.updateFile(file.id, { name: finalName }).subscribe({
   next: () => {
    this.loadFiles();
   },
   error: err => {
    this.errorMsg = err.error?.detail || 'Failed to rename project.';
   }
  });
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
