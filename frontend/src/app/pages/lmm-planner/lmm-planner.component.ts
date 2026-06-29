import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-lmm-planner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lmm-planner.component.html',
  styleUrl: './lmm-planner.component.css'
})
export class LmmPlannerComponent implements OnInit, OnDestroy {
  @ViewChild('plannerFrame') plannerFrame!: ElementRef<HTMLIFrameElement>;

  fileId!: number;
  fileName: string = '';
  loading: boolean = true;
  loadError = '';
  saving: boolean = false;
  iframeLoaded: boolean = false;

  private saveSubject = new Subject<any>();
  private initialPayload: any = null;
  private themeObserver: MutationObserver | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit() {
    this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
    this.api.getFile(this.fileId).subscribe({
      next: (file) => {
        this.fileName = file.name;
        try {
          this.initialPayload = JSON.parse(file.json_payload);
        } catch {
          this.initialPayload = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err.error?.detail || 'Failed to load planner.';
        this.loading = false;
      }
    });

    this.saveSubject.pipe(debounceTime(1500)).subscribe((data) => {
      this.performSave(data);
    });

    // Watch for global theme changes and bridge them into the iframe
    this.themeObserver = new MutationObserver(() => {
      this.syncThemeToIframe();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  ngOnDestroy() {
    this.saveSubject.complete();
    this.themeObserver?.disconnect();
  }

  goBack() {
    this.router.navigate(['/hub']);
  }

  onIframeLoad() {
    this.iframeLoaded = true;
    // Sync current theme into the freshly loaded iframe
    this.syncThemeToIframe();

    if (this.initialPayload && this.initialPayload.tasks) {
      this.plannerFrame.nativeElement.contentWindow?.postMessage({
        action: 'load',
        data: this.initialPayload
      }, '*');
    }
  }

  /** Apply the parent's data-theme directly to the iframe's <html> element */
  private syncThemeToIframe() {
    const iframe = this.plannerFrame?.nativeElement;
    if (!iframe || !this.iframeLoaded) return;
    try {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.documentElement.setAttribute('data-theme', theme);
      }
    } catch {
      // Cross-origin guard — silent fail
    }
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    if (event.data && event.data.action === 'save') {
      this.saveSubject.next(event.data.data);
    } else if (event.data && event.data.action === 'goBack') {
      this.goBack();
    }
  }

  performSave(data: any) {
    this.saving = true;
    this.plannerFrame?.nativeElement?.contentWindow?.postMessage({ action: 'saving' }, '*');

    const payload = JSON.stringify(data);
    this.api.updateFile(this.fileId, { name: data.projectName || this.fileName, json_payload: payload }).subscribe({
      next: () => {
        this.saving = false;
        this.plannerFrame?.nativeElement?.contentWindow?.postMessage({ action: 'saved' }, '*');
      },
      error: () => {
        this.saving = false;
        this.plannerFrame?.nativeElement?.contentWindow?.postMessage({ action: 'saveFailed' }, '*');
      }
    });
  }
}
