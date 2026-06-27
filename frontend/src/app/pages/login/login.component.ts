import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
 selector: 'app-login',
 standalone: true,
 imports: [CommonModule, FormsModule],
 templateUrl: './login.component.html',
 styleUrls: ['./login.component.css']
})
export class LoginComponent {
 isLoginMode = true;
 errorMsg = '';
 
 formData = {
  email: '',
  password: '',
  display_name: ''
 };

 constructor(private authService: AuthService, private router: Router) {
  if (this.authService.isAuthenticated) {
   this.router.navigate(['/hub']);
  }
 }

 toggleMode() {
  this.isLoginMode = !this.isLoginMode;
  this.errorMsg = '';
 }

 onSubmit() {
  this.errorMsg = '';
  const obs$ = this.isLoginMode 
   ? this.authService.login({ email: this.formData.email, password: this.formData.password })
   : this.authService.register(this.formData);

  obs$.subscribe({
   next: () => this.router.navigate(['/hub']),
   error: (err) => {
    this.errorMsg = err.error?.detail || 'An error occurred during authentication.';
   }
  });
 }
}
