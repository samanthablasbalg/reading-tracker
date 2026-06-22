import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService } from '../engagement.service';

export interface FormatPickSheetData {
  bookId: string;
  title: string;
  cover_url: string | null;
}

const FORMATS = [
  { value: 'print', label: 'Print' },
  { value: 'digital', label: 'Digital' },
  { value: 'audio', label: 'Audio' },
] as const;

@Component({
  selector: 'app-format-pick-sheet',
  imports: [NgOptimizedImage, MatButtonModule, MatDialogTitle],
  template: `
    <div
      style="display: flex; flex-direction: column; align-items: center; padding: 16px; gap: 12px;"
    >
      @if (data.cover_url) {
        <img [ngSrc]="data.cover_url" width="60" height="90" [alt]="data.title + ' cover'" />
      }
      <h2 mat-dialog-title style="margin: 0; text-align: center;">{{ data.title }}</h2>
      @for (format of formats; track format.value) {
        <button
          mat-stroked-button
          style="width: 100%;"
          [disabled]="submitting()"
          [attr.aria-label]="'Start reading ' + data.title + ' as ' + format.label"
          (click)="pick(format.value)"
        >
          {{ format.label }}
        </button>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <button mat-button style="width: 100%;" [disabled]="submitting()" (click)="close()">
        Cancel
      </button>
    </div>
  `,
})
export class FormatPickSheetComponent {
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly bottomSheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: FormatPickSheetData =
    inject<FormatPickSheetData>(MAT_DIALOG_DATA, { optional: true }) ??
    inject<FormatPickSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly engagementService = inject(EngagementService);

  protected readonly formats = FORMATS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected pick(format: string): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.engagementService.markReading(this.data.bookId, format).subscribe({
      next: () => {
        this.engagementService.reloadEngagements();
        this.close();
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('Failed to start reading. Please try again.');
      },
    });
  }

  protected close(): void {
    this.dialogRef?.close();
    this.bottomSheetRef?.dismiss();
  }
}
