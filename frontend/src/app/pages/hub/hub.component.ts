import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ShareModalComponent } from '../../shared/share-modal/share-modal.component';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, ShareModalComponent],
  templateUrl: './hub.component.html',
  styleUrls: ['./hub.component.css']
})
export class HubComponent implements OnInit {
  files: any[] = [];
  selectedToolType: string = '';

  // Share Modal state
  isShareModalOpen = false;
  selectedFileId: number | null = null;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.loadFiles();
  }

  loadFiles() {
    this.api.getFiles(this.selectedToolType || undefined).subscribe(files => {
      this.files = files;
    });
  }

  setFilter(type: string) {
    this.selectedToolType = type;
    this.loadFiles();
  }

  createNew(toolType: string) {
    const defaultPayloads: any = {
      lmm: '{"tasks":[], "resources":[]}',
      organigram: '{"title":"New Organigram","nodes":[]}',
      dashboard: '{"meta":{"title":"New Dashboard"}}'
    };

    const newFile = {
      tool_type: toolType,
      name: `Untitled ${toolType.toUpperCase()}`,
      json_payload: defaultPayloads[toolType]
    };

    this.api.createFile(newFile).subscribe(file => {
      this.openFile(file.id, toolType);
    });
  }

  openFile(id: number, toolType: string) {
    if (toolType === 'lmm') this.router.navigate(['/tools/lmm', id]);
    else if (toolType === 'organigram') this.router.navigate(['/tools/organigram', id]);
    else if (toolType === 'dashboard') this.router.navigate(['/tools/dashboard', id]);
  }

  deleteFile(id: number) {
    if (confirm('Are you sure you want to delete this file? This cannot be undone.')) {
      this.api.deleteFile(id).subscribe(() => {
        this.loadFiles();
      });
    }
  }

  openShareModal(id: number) {
    this.selectedFileId = id;
    this.isShareModalOpen = true;
  }

  closeShareModal() {
    this.isShareModalOpen = false;
    this.selectedFileId = null;
  }

  onShared(clonedFile: any) {
    // Shared successfully
    this.closeShareModal();
    // Maybe show a toast
  }

  getToolName(type: string) {
    return {
      'lmm': 'LMM Planner',
      'organigram': 'Organigram',
      'dashboard': 'Dashboard'
    }[type] || type;
  }
}
