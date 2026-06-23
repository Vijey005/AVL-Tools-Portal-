import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  users: any[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.api.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
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

  deleteUser(user: any) {
    if (confirm(`Are you sure you want to permanently delete user ${user.email}? This will also delete ALL their files.`)) {
      this.api.deleteUser(user.id).subscribe(() => {
        this.loadUsers();
      });
    }
  }
}
