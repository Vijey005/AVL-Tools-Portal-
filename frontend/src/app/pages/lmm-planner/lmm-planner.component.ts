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
  saving: boolean = false;
  iframeLoaded: boolean = false;
  
  private saveSubject = new Subject<any>();
  private initialPayload: any = null;

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit() {
    this.fileId = Number(this.route.snapshot.paramMap.get('fileId'));
    this.api.getFile(this.fileId).subscribe({
      next: (file) => {
        this.fileName = file.name;
        try {
          this.initialPayload = JSON.parse(file.json_payload);
        } catch {
          this.initialPayload = null; // Let the iframe use default if empty
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });

    this.saveSubject.pipe(debounceTime(1500)).subscribe((data) => {
      this.performSave(data);
    });
  }

  ngOnDestroy() {
    this.saveSubject.complete();
  }

  goBack() {
    this.router.navigate(['/hub']);
  }

  onIframeLoad() {
    this.iframeLoaded = true;
    if (this.initialPayload && this.initialPayload.tasks) {
      this.plannerFrame.nativeElement.contentWindow?.postMessage({
        action: 'load',
        data: this.initialPayload
      }, '*');
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
        this.plannerFrame?.nativeElement?.contentWindow?.postMessage({ action: 'saved' }, '*');
      }
    });
  }
}
