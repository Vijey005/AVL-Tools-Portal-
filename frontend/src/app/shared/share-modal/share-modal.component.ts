import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-modal.component.html',
  styleUrls: ['./share-modal.component.css']
})
export class ShareModalComponent {
  @Input() fileId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() shared = new EventEmitter<any>();

  recipientEmail: string = '';
  errorMsg: string = '';
  successMsg: string = '';
  loading = false;

  constructor(private api: ApiService) {}

  share() {
    if (!this.fileId || !this.recipientEmail) return;

    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    this.api.shareFile(this.fileId, this.recipientEmail).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMsg = 'File cloned and shared successfully!';
        setTimeout(() => {
          this.shared.emit(res);
        }, 1000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.detail || 'Error sharing file.';
      }
    });
  }

  onClose() {
    this.close.emit();
  }
}
