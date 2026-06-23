import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:8000/api';

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

  shareFile(id: number, recipientEmail: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/files/${id}/share`, { recipient_email: recipientEmail });
  }

  // --- Admin API ---
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/users`);
  }

  updateUser(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/users/${id}`, data);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/admin/users/${id}`);
  }
}
