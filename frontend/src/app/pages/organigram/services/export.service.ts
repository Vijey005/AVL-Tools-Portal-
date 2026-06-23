// ============================================================
// ExportService
// Handles PNG export (html2canvas) and Print/PDF.
// Provided at component level (not root).
// ============================================================

import { Injectable } from '@angular/core';

declare const html2canvas: any;

@Injectable()
export class ExportService {

  // ── PNG Export ────────────────────────────────────────────

  async exportPng(canvasEl: HTMLElement, title: string): Promise<void> {
    await this.ensureHtml2Canvas();

    const hostEl = canvasEl.closest('.org-app') as HTMLElement | null;
    const wasEdit = hostEl?.classList.contains('edit-mode') ?? false;
    if (wasEdit && hostEl) hostEl.classList.remove('edit-mode');

    // Allow repaint
    await this.delay(120);

    try {
      const canvas = await html2canvas(canvasEl, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const fileName = `${(title || 'organigram').replace(/[^a-z0-9_-]+/gi, '_')}.png`;
      canvas.toBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
      });
    } finally {
      if (wasEdit && hostEl) hostEl.classList.add('edit-mode');
    }
  }

  // ── Print / PDF ───────────────────────────────────────────

  printChart(hostEl: HTMLElement): void {
    const wasEdit = hostEl.classList.contains('edit-mode');
    if (wasEdit) hostEl.classList.remove('edit-mode');

    setTimeout(() => {
      window.print();
      if (wasEdit) {
        // Restore after print dialog closes
        setTimeout(() => hostEl.classList.add('edit-mode'), 200);
      }
    }, 100);
  }

  // ── Photo resize (shared utility) ─────────────────────────

  resizePhoto(file: File, maxSize = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(maxSize / w, maxSize / h, 1);
        const cw = Math.round(w * scale), ch = Math.round(h * scale);
        const cnv = document.createElement('canvas');
        cnv.width = cw; cnv.height = ch;
        cnv.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        try { resolve(cnv.toDataURL('image/jpeg', 0.82)); }
        catch (e) { reject(e); }
      };
      img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  /** Trigger file picker and return resized base64 */
  async pickAndResizePhoto(maxSize = 200): Promise<string | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        try { resolve(await this.resizePhoto(file, maxSize)); }
        catch   { resolve(null); }
      };
      input.click();
    });
  }

  // ── Private helpers ───────────────────────────────────────

  private html2canvasLoaded = false;

  private ensureHtml2Canvas(): Promise<void> {
    if (this.html2canvasLoaded || (typeof window !== 'undefined' && (window as any).html2canvas)) {
      this.html2canvasLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload  = () => { this.html2canvasLoaded = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
