import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService } from '../engagement.service';
import { parseHhmm, hhmmFormatValidator } from '../hhmm';

export interface FormatPickSheetData {
  bookId: string;
  title: string;
  cover_url: string | null;
  default_audio_minutes: number | null;
}

const FORMATS = [
  { value: 'print', label: 'Print' },
  { value: 'digital', label: 'Digital' },
  { value: 'audio', label: 'Audio' },
] as const;

@Component({
  selector: 'app-format-pick-sheet',
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogTitle,
  ],
  template: `
    <div
      style="display: flex; flex-direction: column; align-items: center; padding: 16px; gap: 12px;"
    >
      @if (data.cover_url) {
        <img [ngSrc]="data.cover_url" width="60" height="90" [alt]="data.title + ' cover'" />
      }
      <h2 mat-dialog-title style="margin: 0; text-align: center;">{{ data.title }}</h2>
      @if (mode() === 'picking') {
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
      } @else {
        <mat-form-field style="width: 100%;">
          <mat-label>How long is the audiobook?</mat-label>
          <input matInput [formControl]="lengthControl" placeholder="HH:MM" />
          @if (lengthControl.hasError('hhmm')) {
            <mat-error>Enter a time in HH:MM format</mat-error>
          }
        </mat-form-field>
        <button
          mat-flat-button
          style="width: 100%;"
          [disabled]="lengthControl.invalid || submitting()"
          [attr.aria-label]="'Start reading ' + data.title + ' as Audio'"
          (click)="submitWithLength()"
        >
          {{ submitting() ? 'Starting…' : 'Start reading' }}
        </button>
        <button
          mat-button
          style="width: 100%;"
          [disabled]="submitting()"
          (click)="mode.set('picking')"
        >
          Go back
        </button>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (mode() === 'picking') {
        <button mat-button style="width: 100%;" [disabled]="submitting()" (click)="close()">
          Cancel
        </button>
      }
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
  protected readonly mode = signal<'picking' | 'collectingLength'>('picking');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly lengthControl = new FormControl<string | null>(null, [
    Validators.required,
    hhmmFormatValidator(),
  ]);

  protected pick(format: string): void {
    if (this.submitting()) return;

    if (format === 'audio' && this.data.default_audio_minutes === null) {
      this.mode.set('collectingLength');
      return;
    }

    this.startReading(format);
  }

  protected submitWithLength(): void {
    if (this.lengthControl.invalid || this.submitting()) return;
    const length = parseHhmm(this.lengthControl.value)!;
    this.startReading('audio', length);
  }

  private startReading(format: string, audioLengthMinutes?: number): void {
    this.submitting.set(true);
    this.error.set(null);

    this.engagementService.markReading(this.data.bookId, format, audioLengthMinutes).subscribe({
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
