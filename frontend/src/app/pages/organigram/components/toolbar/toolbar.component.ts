import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganigramOptions } from '../../models/organigram.models';

export type ToolbarAction =
  | 'new' | 'save' | 'load' | 'directory' | 'exportPng' | 'print';

@Component({
  selector: 'app-org-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css'],
})
export class ToolbarComponent {
  @Input() isEditMode = true;
  @Input() isSaving   = false;
  @Input() dirCount   = 0;
  @Input() options!: OrganigramOptions;

  @Output() action          = new EventEmitter<ToolbarAction>();
  @Output() toggleEdit      = new EventEmitter<void>();
  @Output() optionsChange   = new EventEmitter<Partial<OrganigramOptions>>();

  showSettings = signal(false);

  onAction(a: ToolbarAction): void { this.action.emit(a); }

  toggleSettings(e: MouseEvent): void {
    e.stopPropagation();
    this.showSettings.update(v => !v);
  }

  closeSettings(): void { this.showSettings.set(false); }

  readonly contactFields: { key: 'photo' | 'post' | 'email' | 'phone'; label: string }[] = [
    { key: 'photo', label: 'Photo' },
    { key: 'post',  label: 'Post'  },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ];

  // ── Options bindings (ngModel bridges) ────────────────────

  toggleSection(key: 'showSideRoles' | 'showCoordinators' | 'showTeamLabels' | 'showBottom', val: boolean): void {
    this.optionsChange.emit({ [key]: val });
  }

  toggleContact(zone: 'coord' | 'wp' | 'team', field: 'photo' | 'post' | 'email' | 'phone', val: boolean): void {
    const zoneKey = (zone + 'Contact') as 'coordContact' | 'wpContact' | 'teamContact';
    this.optionsChange.emit({ [zoneKey]: { ...this.options[zoneKey], [field]: val } });
  }
}
