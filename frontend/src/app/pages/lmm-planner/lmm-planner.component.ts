import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

interface LmmTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  assignedResourceIds: string[];
}

interface LmmResource {
  id: string;
  name: string;
  role: string;
  capacity: number;
}

interface LmmState {
  _type: string;
  _version: number;
  project: {
    title: string;
    manager: string;
    status: 'planning' | 'active' | 'completed';
  };
  tasks: LmmTask[];
  resources: LmmResource[];
}

@Component({
  selector: 'app-lmm-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lmm-planner.component.html',
  styleUrl: './lmm-planner.component.css'
})
export class LmmPlannerComponent implements OnInit, OnDestroy {
  fileId!: number;
  fileName: string = '';
  state!: LmmState;
  loading: boolean = true;
  saving: boolean = false;
  
  viewMode: 'tasks' | 'resources' = 'tasks';

  private saveSubject = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
    this.api.getFile(this.fileId).subscribe({
      next: (file) => {
        this.fileName = file.name;
        this.parsePayload(file.json_payload);
        this.loading = false;
      },
      error: (err) => console.error(err)
    });

    this.saveSubject.pipe(debounceTime(1500)).subscribe(() => {
      this.performSave();
    });
  }

  ngOnDestroy() {
    this.saveSubject.complete();
  }

  parsePayload(payloadStr: string) {
    try {
      this.state = JSON.parse(payloadStr);
      if (!this.state.tasks) this.initEmptyState();
    } catch {
      this.initEmptyState();
    }
  }

  initEmptyState() {
    this.state = {
      _type: 'AVL_LMM_Planner',
      _version: 13,
      project: {
        title: 'New LMM Project',
        manager: '',
        status: 'planning'
      },
      tasks: [],
      resources: []
    };
    this.triggerSave();
  }

  triggerSave() {
    this.saveSubject.next();
  }

  performSave() {
    this.saving = true;
    const payload = JSON.stringify(this.state);
    this.api.updateFile(this.fileId, { name: this.fileName, json_payload: payload }).subscribe({
      next: () => this.saving = false,
      error: () => this.saving = false
    });
  }

  // Task Methods
  addTask() {
    this.state.tasks.push({
      id: Math.random().toString(36).substring(2, 9),
      name: 'New Task',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      progress: 0,
      assignedResourceIds: []
    });
    this.triggerSave();
  }

  deleteTask(id: string) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    this.triggerSave();
  }

  // Resource Methods
  addResource() {
    this.state.resources.push({
      id: Math.random().toString(36).substring(2, 9),
      name: 'New Resource',
      role: 'Engineer',
      capacity: 100
    });
    this.triggerSave();
  }

  deleteResource(id: string) {
    this.state.resources = this.state.resources.filter(r => r.id !== id);
    // Remove from assigned tasks
    this.state.tasks.forEach(t => {
      t.assignedResourceIds = t.assignedResourceIds.filter(rid => rid !== id);
    });
    this.triggerSave();
  }

  getResourceName(id: string): string {
    const res = this.state.resources.find(r => r.id === id);
    return res ? res.name : 'Unknown';
  }
}
