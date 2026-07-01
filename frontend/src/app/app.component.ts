import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'AVL Unified Tools Portal';
  emails: any[] = [];
  isOpen = false;
  unreadCount = 0;
  inboxLabel = '';
  private lastSeenCount = 0;
  private pollingSub?: Subscription;
  private userSub?: Subscription;
  private currentUserEmail: string | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.userSub = this.auth.currentUser$.subscribe((user) => {
      this.currentUserEmail = user?.email ?? null;
      this.loadEmails();
    });
    this.loadEmails();
    this.pollingSub = interval(3000).subscribe(() => {
      this.pollEmails();
    });
  }

  ngOnDestroy() {
    this.pollingSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  private getEmailFilter(): string | undefined {
    if (this.currentUserEmail) {
      return this.currentUserEmail;
    }
    return localStorage.getItem('avl-forgot-email') || undefined;
  }

  loadEmails() {
    const email = this.getEmailFilter();
    this.inboxLabel = email ? `Showing mail for ${email}` : 'Submit forgot-password with your email to view messages here';
    this.api.getMockEmails(email).subscribe({
      next: (data) => {
        this.emails = data;
        this.lastSeenCount = data.length;
        this.unreadCount = 0;
      },
      error: () => {}
    });
  }

  pollEmails() {
    const email = this.getEmailFilter();
    this.api.getMockEmails(email).subscribe({
      next: (data) => {
        if (data.length > this.emails.length) {
          const diff = data.length - this.emails.length;
          if (!this.isOpen) {
            this.unreadCount += diff;
          }
        }
        this.emails = data;
      },
      error: () => {}
    });
  }

  toggleInbox() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
      this.lastSeenCount = this.emails.length;
    }
  }

  formatBody(body: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => {
      return `<a href="${url}" style="color: #005A99; font-weight: 600; text-decoration: underline;">Click here to reset your password.</a>`;
    }).replace(/\n/g, '<br>');
  }
}
