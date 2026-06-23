import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { OrgNodeComponent, OrgNode } from './org-node.component';

interface OrganigramState {
  _type: string;
  _version: number;
  title: string;
  subtitle: string;
  rootNode: OrgNode;
}

@Component({
  selector: 'app-organigram',
  standalone: true,
  imports: [CommonModule, FormsModule, OrgNodeComponent],
  templateUrl: './organigram.component.html',
  styleUrl: './organigram.component.css'
})
export class OrganigramComponent implements OnInit, OnDestroy {
  fileId!: number;
  fileName: string = '';
  state!: OrganigramState;
  loading: boolean = true;
  saving: boolean = false;
  
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
      if (!this.state.rootNode) this.initEmptyState();
    } catch {
      this.initEmptyState();
    }
  }

  initEmptyState() {
    this.state = {
      _type: 'AVL_Organigram',
      _version: 3,
      title: 'Project Name',
      subtitle: 'Organigram',
      rootNode: {
        id: 'root',
        type: 'pm',
        title: 'Project Manager',
        subtitle: 'Name',
        color: '#008080',
        children: []
      }
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
}
