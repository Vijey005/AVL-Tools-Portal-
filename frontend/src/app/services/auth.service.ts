import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, map } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api/users';
  private tokenKey = 'avl_token';

  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkToken();
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isAdmin(): boolean {
    return this.currentUserSubject.value?.is_admin === true;
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (res.access_token) {
          localStorage.setItem(this.tokenKey, res.access_token);
          this.fetchProfile().subscribe();
        }
      })
    );
  }

  register(userData: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, userData).pipe(
      tap(res => {
        if (res.access_token) {
          localStorage.setItem(this.tokenKey, res.access_token);
          this.fetchProfile().subscribe();
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  fetchProfile() {
    return this.http.get<any>(`${this.apiUrl}/me`).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
      })
    );
  }

  private checkToken() {
    if (this.token) {
      this.fetchProfile().subscribe({
        error: () => this.logout() // invalid token
      });
    }
  }
}
