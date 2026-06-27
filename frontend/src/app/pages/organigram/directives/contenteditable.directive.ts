// ============================================================
// ContentEditableDirective
// Provides safe two-way binding for contenteditable elements.
//
// Why this exists:
//  Angular's default (input) binding on a div resets innerHTML
//  every keystroke, causing cursor to jump to position 0.
//  This directive commits on (blur) instead, and guards against
//  resetting content when the external model value hasn't changed.
//
// Usage:
//  <div [avlCe]="person.name"
//    (avlCeChange)="onNameChange($event)"
//    [avlCeDisabled]="!isEditMode"
//    data-placeholder="Name"></div>
// ============================================================

import {
 Directive, ElementRef, EventEmitter, HostListener,
 Input, OnChanges, Output, Renderer2, SimpleChanges,
} from '@angular/core';

@Directive({
 selector: '[avlCe]',
 standalone: true,
})
export class ContentEditableDirective implements OnChanges {

 /** The value to display */
 @Input('avlCe') value = '';

 /** Two-way binding change event */
 @Output('avlCeChange') valueChange = new EventEmitter<string>();

 /** When true sets contenteditable="false" */
 @Input() avlCeDisabled = false;

 private _focused = false;

 constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {}

 ngOnChanges(changes: SimpleChanges): void {
  if (changes['avlCeDisabled']) {
   this.renderer.setAttribute(
    this.el.nativeElement,
    'contenteditable',
    this.avlCeDisabled ? 'false' : 'true'
   );
  }

  // Only push new value if element is NOT focused — avoids cursor jump
  if (changes['value'] && !this._focused) {
   const current = this.el.nativeElement.textContent ?? '';
   if (current !== this.value) {
    this.el.nativeElement.textContent = this.value ?? '';
   }
  }
 }

 @HostListener('focus')
 onFocus(): void { this._focused = true; }

 /** Commit on blur — not on every keystroke */
 @HostListener('blur')
 onBlur(): void {
  this._focused = false;
  const text = this.el.nativeElement.textContent ?? '';
  this.valueChange.emit(text);
 }

 /** Strip rich text on paste — plain text only */
 @HostListener('paste', ['$event'])
 onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  document.execCommand('insertText', false, text);
 }

 /** Prevent Enter from inserting <br> or <div> */
 @HostListener('keydown', ['$event'])
 onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
   event.preventDefault();
   this.el.nativeElement.blur();
  }
 }
}
