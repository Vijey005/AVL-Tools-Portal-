import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subscription, interval } from 'rxjs';

@Component({
 selector: 'app-admin',
 standalone: true,
 imports: [CommonModule, FormsModule],
 templateUrl: './admin.component.html',
 styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
 users: any[] = [];
 loading = true;
 errorMsg = '';
 private pollingSub?: Subscription;

 constructor(private api: ApiService) {}

 ngOnInit() {
  this.loadUsers();
  // Poll for real-time updates every 3 seconds
  this.pollingSub = interval(3000).subscribe(() => this.pollUsers());
 }

 ngOnDestroy() {
  if (this.pollingSub) {
   this.pollingSub.unsubscribe();
  }
 }

 loadUsers() {
  this.loading = true;
  this.errorMsg = '';
  this.api.getUsers().subscribe({
   next: (data) => {
    this.users = data;
    this.loading = false;
   },
   error: (err) => {
    this.loading = false;
    this.errorMsg = err.error?.detail || 'Unable to load users. Ensure the backend server is running.';
   }
  });
 }

 pollUsers() {
  this.api.getUsers().subscribe({
   next: (data) => {
    this.users = data;
    this.errorMsg = ''; // clear any transient errors
   },
   error: (err) => {
    // silently fail polling or update errorMsg if needed
    // this.errorMsg = err.error?.detail || 'Lost connection to server.';
   }
  });
 }

 toggleAdmin(user: any) {
  this.api.updateUser(user.id, { is_admin: !user.is_admin }).subscribe(() => {
   this.loadUsers();
  });
 }

 toggleActive(user: any) {
  this.api.updateUser(user.id, { is_active: !user.is_active }).subscribe(() => {
   this.loadUsers();
  });
 }

 toggleApproved(user: any) {
  this.api.updateUser(user.id, { is_approved: !user.is_approved }).subscribe(() => {
   this.loadUsers();
  });
 }

 deleteUser(user: any) {
  if (confirm(`Are you sure you want to permanently delete user ${user.email}? This will also delete ALL their files.`)) {
   this.api.deleteUser(user.id).subscribe(() => {
    this.loadUsers();
   });
  }
 }
}
