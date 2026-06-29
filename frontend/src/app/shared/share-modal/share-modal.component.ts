import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
 selector: 'app-share-modal',
 standalone: true,
 imports: [CommonModule, FormsModule],
 templateUrl: './share-modal.component.html',
 styleUrls: ['./share-modal.component.css']
})
export class ShareModalComponent implements OnInit, OnDestroy {
 @Input() fileId: number | null = null;
 @Output() close = new EventEmitter<void>();
 @Output() shared = new EventEmitter<any>();

 targetEmail: string = '';
 shareType: 'duplicate' | 'original' = 'duplicate';
 errorMsg: string = '';
 successMsg: string = '';
 loading = false;

 searchResults: any[] = [];
 isSearching = false;
 showDropdown = false;
 private searchSubject = new Subject<string>();
 private searchSubscription?: Subscription;

 constructor(private api: ApiService) {}

 ngOnInit() {
  this.searchSubscription = this.searchSubject.pipe(
   debounceTime(300),
   distinctUntilChanged()
  ).subscribe(query => {
   if (!query || query.length < 2) {
    this.searchResults = [];
    this.isSearching = false;
    return;
   }
   
   this.api.searchUsers(query).subscribe({
    next: (results) => {
     this.searchResults = results;
     this.isSearching = false;
    },
    error: () => {
     this.searchResults = [];
     this.isSearching = false;
    }
   });
  });
 }

 ngOnDestroy() {
  if (this.searchSubscription) {
   this.searchSubscription.unsubscribe();
  }
 }

 onSearchChange(query: string) {
  this.targetEmail = query;
  this.showDropdown = true;
  this.isSearching = true;
  this.searchSubject.next(query);
 }

 selectUser(user: any) {
  this.targetEmail = user.email;
  this.showDropdown = false;
 }

 @HostListener('document:click')
 closeDropdown() {
  this.showDropdown = false;
 }

 share() {
  if (!this.fileId || !this.targetEmail) return;

  this.loading = true;
  this.errorMsg = '';
  this.successMsg = '';

  this.api.shareFile(this.fileId, this.targetEmail, this.shareType).subscribe({
   next: (res) => {
    this.loading = false;
    this.successMsg = res.message || 'File shared successfully!';
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
