import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
 providedIn: 'root'
})
export class ApiService {
 private apiUrl = '/api';

 constructor(private http: HttpClient) {}

 // --- Files API ---
 getFiles(toolType?: string): Observable<any[]> {
  let url = `${this.apiUrl}/files`;
  if (toolType) {
   url += `?tool_type=${toolType}`;
  }
  return this.http.get<any[]>(url);
 }

 getFile(id: number): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/files/${id}`);
 }

 createFile(data: { tool_type: string, name: string, json_payload: string }): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/files`, data);
 }

 updateFile(id: number, data: { name?: string, json_payload?: string }): Observable<any> {
  return this.http.put<any>(`${this.apiUrl}/files/${id}`, data);
 }

 deleteFile(id: number): Observable<any> {
  return this.http.delete<any>(`${this.apiUrl}/files/${id}`);
 }

 shareFile(fileId: number, targetEmail: string, shareType: 'duplicate' | 'original' = 'duplicate') {
  return this.http.post<any>(`${this.apiUrl}/files/${fileId}/share`, { target_email: targetEmail, share_type: shareType });
 }

 // --- Admin API ---
 getUsers(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/admin/users`);
 }

 searchUsers(query: string): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/users/search?q=${encodeURIComponent(query)}`);
 }

 updateUser(id: number, data: any): Observable<any> {
  return this.http.put<any>(`${this.apiUrl}/admin/users/${id}`, data);
 }

 deleteUser(id: number): Observable<any> {
  return this.http.delete<any>(`${this.apiUrl}/admin/users/${id}`);
 }

 // --- Password Reset API ---
 forgotPassword(email: string): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/users/forgot-password`, { email });
 }

 resetPassword(token: string, new_password: string): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/users/reset-password`, { token, new_password });
 }

 getResetRequests(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/admin/reset-requests`);
 }

 reviewResetRequest(requestId: number, action: 'approve' | 'reject'): Observable<any> {
  return this.http.put<any>(`${this.apiUrl}/admin/reset-requests/${requestId}`, { action });
 }

 getMockEmails(email?: string): Observable<any[]> {
  let url = `${this.apiUrl}/users/debug/emails`;
  if (email) {
   url += `?email=${encodeURIComponent(email)}`;
  }
  return this.http.get<any[]>(url);
 }

 getAnalyticsDashboard(): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/analytics/dashboard`);
 }
}
