import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  isDark = false;
  isProfileOpen = false;

  constructor(public auth: AuthService) {
    // Read saved theme; default to light
    const saved = localStorage.getItem('avl-theme') || 'light';
    this.isDark = saved === 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('avl-theme', theme);
  }

  toggleProfileMenu() {
    this.isProfileOpen = !this.isProfileOpen;
  }

  closeProfileMenuDelayed() {
    // Small delay so click events on dropdown items can fire before closing
    setTimeout(() => { this.isProfileOpen = false; }, 200);
  }

  getInitials(name: string = ''): string {
    const parts = name.trim().split(/\s+/);
    if (!parts.length || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  logout() {
    this.isProfileOpen = false;
    const confirmed = window.confirm('Sign out of AVL Tools Portal?');
    if (confirmed) {
      this.auth.logout();
    }
  }
}
