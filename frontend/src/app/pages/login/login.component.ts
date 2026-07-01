import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
 selector: 'app-login',
 standalone: true,
 imports: [CommonModule, FormsModule],
 templateUrl: './login.component.html',
 styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
 // Modes: 'login' | 'register' | 'forgot' | 'reset'
 mode: 'login' | 'register' | 'forgot' | 'reset' = 'login';
 errorMsg = '';
 successMsg = '';
 
 formData = {
  email: '',
  password: '',
  display_name: ''
 };

 forgotEmail = '';
 resetToken = '';
 newPassword = '';
 confirmPassword = '';

 constructor(
  private authService: AuthService,
  private apiService: ApiService,
  private router: Router,
  private route: ActivatedRoute
 ) {
  if (this.authService.isAuthenticated) {
   this.router.navigate(['/hub']);
  }
 }

 ngOnInit() {
  // Check for reset token in URL (e.g. ?token=xxxxx)
  this.route.queryParams.subscribe(params => {
   if (params['token']) {
    this.resetToken = params['token'];
    this.switchMode('reset');
    this.successMsg = 'Reset token pre-loaded from email link. Set your new password below.';
   }
  });
 }

 // Legacy compatibility
 get isLoginMode(): boolean {
  return this.mode === 'login';
 }

 switchMode(mode: 'login' | 'register' | 'forgot' | 'reset') {
  this.mode = mode;
  this.errorMsg = '';
  this.successMsg = '';
 }

 toggleMode() {
  this.switchMode(this.mode === 'login' ? 'register' : 'login');
 }

 onSubmit() {
  this.errorMsg = '';
  this.successMsg = '';
  const obs$ = this.mode === 'login' 
   ? this.authService.login({ email: this.formData.email, password: this.formData.password })
   : this.authService.register(this.formData);

  obs$.subscribe({
   next: (res: any) => {
     if (this.mode === 'login') {
       this.router.navigate(['/hub']);
     } else {
       // Registration returns a message instead of token
       this.successMsg = res.message || 'Registration successful. Please wait for an admin to approve your account.';
       this.mode = 'login'; // Switch back to login
     }
   },
   error: (err) => {
    this.errorMsg = err.error?.detail || 'An error occurred during authentication.';
   }
  });
 }

 onForgotPassword() {
  this.errorMsg = '';
  this.successMsg = '';

  if (!this.forgotEmail) {
   this.errorMsg = 'Please enter your email address.';
   return;
  }

  this.apiService.forgotPassword(this.forgotEmail).subscribe({
   next: (res: any) => {
    localStorage.setItem('avl-forgot-email', this.forgotEmail.trim().toLowerCase());
    this.successMsg = res.message || 'Password reset request submitted for admin approval.';
   },
   error: (err) => {
    this.errorMsg = err.error?.detail || 'An error occurred. Please try again.';
   }
  });
 }

 onResetPassword() {
  this.errorMsg = '';
  this.successMsg = '';

  if (!this.resetToken) {
   this.errorMsg = 'Invalid reset link. Open the link from your approval email.';
   return;
  }
  if (!this.newPassword || this.newPassword.length < 4) {
   this.errorMsg = 'Password must be at least 4 characters.';
   return;
  }
  if (this.newPassword !== this.confirmPassword) {
   this.errorMsg = 'Passwords do not match.';
   return;
  }

  this.apiService.resetPassword(this.resetToken, this.newPassword).subscribe({
   next: (res: any) => {
    this.successMsg = res.message || 'Password reset successfully!';
    // Clear the form
    this.resetToken = '';
    this.newPassword = '';
    this.confirmPassword = '';
   },
   error: (err) => {
    this.errorMsg = err.error?.detail || 'Invalid or expired reset token.';
   }
  });
 }
}
