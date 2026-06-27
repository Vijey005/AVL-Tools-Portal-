import {
 Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Person, ContactOptions, initials } from '../../models/organigram.models';
import { ContentEditableDirective } from '../../directives/contenteditable.directive';
import { ExportService } from '../../services/export.service';

@Component({
 selector: 'app-person-card',
 standalone: true,
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [CommonModule, ContentEditableDirective],
 templateUrl: './person-card.component.html',
 styleUrls: ['./person-card.component.css'],
})
export class PersonCardComponent {
 @Input() person!: Person;
 @Input() contactOpts!: ContactOptions;
 @Input() avatarSize: 'normal' | 'small' | 'tiny' = 'normal';
 @Input() namePlaceholder = 'Name';
 @Input() showDeleteBtn = true;
 @Input() isEditMode = false;

 @Output() personChange = new EventEmitter<Partial<Person>>();
 @Output() delete    = new EventEmitter<void>();

 constructor(private exportSvc: ExportService) {}

 get avatarClass(): string {
  return this.avatarSize === 'small' ? 'avatar small'
     : this.avatarSize === 'tiny' ? 'avatar tiny'
     : 'avatar';
 }

 get initials(): string {
  return this.person?.photo ? '' : initials(this.person?.name);
 }

 get photoStyle(): string {
  return this.person?.photo
   ? `background-image:url('${this.person.photo}'); background-color:transparent;`
   : '';
 }

 onField(field: keyof Person, value: string): void {
  this.personChange.emit({ [field]: value });
 }

 async onAvatarClick(): Promise<void> {
  if (!this.isEditMode) return;
  const photo = await this.exportSvc.pickAndResizePhoto(200);
  if (photo) this.personChange.emit({ photo });
 }
}
