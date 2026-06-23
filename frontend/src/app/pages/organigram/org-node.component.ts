import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface OrgNode {
  id: string;
  type: 'pm' | 'coordinator' | 'wp' | 'team';
  title: string;
  subtitle: string;
  color: string;
  collapsed?: boolean;
  children: OrgNode[];
}

@Component({
  selector: 'app-org-node',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="org-node-wrapper" [class.is-root]="isRoot">
      <!-- The Node Card -->
      <div class="org-card glass-panel" [style.border-top-color]="node.color">
        <div class="card-header">
          <span class="badge" [style.background]="node.color">{{ node.type | uppercase }}</span>
          <div class="actions">
            <button class="btn-icon mini" (click)="node.collapsed = !node.collapsed" *ngIf="node.children.length > 0">
              {{ node.collapsed ? '➕' : '➖' }}
            </button>
            <button class="btn-icon mini danger" (click)="delete.emit(node.id)" *ngIf="!isRoot">✕</button>
          </div>
        </div>
        <div class="card-body">
          <input class="title-input" [(ngModel)]="node.title" (ngModelChange)="changed.emit()" placeholder="Title">
          <input class="subtitle-input" [(ngModel)]="node.subtitle" (ngModelChange)="changed.emit()" placeholder="Subtitle/Name">
        </div>
        <div class="card-footer">
          <select class="color-picker" [(ngModel)]="node.color" (ngModelChange)="changed.emit()">
            <option value="#008080">Teal</option>
            <option value="#2ea043">Green</option>
            <option value="#58a6ff">Blue</option>
            <option value="#f85149">Red</option>
            <option value="#d29922">Amber</option>
            <option value="#8957e5">Purple</option>
          </select>
          <button class="btn-icon mini add" (click)="addChild()">➕ Child</button>
        </div>
      </div>

      <!-- Recursive Children -->
      <div class="children-container" *ngIf="node.children.length > 0 && !node.collapsed">
        <div class="child-wrapper" *ngFor="let child of node.children">
          <app-org-node 
            [node]="child" 
            [isRoot]="false" 
            (changed)="changed.emit()" 
            (delete)="onDeleteChild($event)">
          </app-org-node>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .org-node-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .org-card {
      width: 240px;
      padding: 12px;
      border-top-width: 4px;
      border-top-style: solid;
      margin: 10px 0;
      position: relative;
      z-index: 2;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
      font-weight: bold;
    }
    .actions { display: flex; gap: 4px; }
    .btn-icon.mini {
      width: 24px; height: 24px; font-size: 0.75rem; padding: 0;
      background: transparent; border: 1px solid var(--border-subtle);
      border-radius: 4px; color: var(--text-muted); cursor: pointer;
    }
    .btn-icon.mini:hover { background: var(--bg-surface-elevated); color: #fff; }
    .title-input {
      width: 100%; background: transparent; border: none; border-bottom: 1px dashed var(--border-subtle);
      color: #fff; font-weight: 600; font-size: 0.95rem; margin-bottom: 6px;
    }
    .subtitle-input {
      width: 100%; background: transparent; border: none; border-bottom: 1px dashed var(--border-subtle);
      color: var(--text-muted); font-size: 0.85rem;
    }
    .title-input:focus, .subtitle-input:focus { outline: none; border-bottom-color: var(--avl-primary); }
    .card-footer {
      display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
    }
    .color-picker {
      background: var(--bg-base); color: var(--text-main); border: 1px solid var(--border-subtle);
      border-radius: 4px; font-size: 0.75rem; padding: 2px;
    }
    
    /* Tree Lines */
    .children-container {
      display: flex;
      gap: 20px;
      padding-top: 20px;
      position: relative;
    }
    .children-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 2px;
      height: 20px;
      background: var(--border-subtle);
      transform: translateX(-50%);
    }
    .child-wrapper {
      position: relative;
      padding-top: 20px;
    }
    .child-wrapper::before {
      content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 20px;
      background: var(--border-subtle); transform: translateX(-50%);
    }
    /* Horizontal connector */
    .child-wrapper::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: var(--border-subtle);
    }
    .child-wrapper:first-child::after { left: 50%; }
    .child-wrapper:last-child::after { right: 50%; }
    .child-wrapper:first-child:last-child::after { display: none; }
  `]
})
export class OrgNodeComponent {
  @Input() node!: OrgNode;
  @Input() isRoot: boolean = false;
  @Output() changed = new EventEmitter<void>();
  @Output() delete = new EventEmitter<string>();

  addChild() {
    this.node.children.push({
      id: Math.random().toString(36).substring(2, 9),
      type: 'wp',
      title: 'New Node',
      subtitle: '',
      color: '#58a6ff',
      children: []
    });
    this.node.collapsed = false;
    this.changed.emit();
  }

  onDeleteChild(id: string) {
    if (confirm('Delete this node and all its children?')) {
      this.node.children = this.node.children.filter(c => c.id !== id);
      this.changed.emit();
    }
  }
}
