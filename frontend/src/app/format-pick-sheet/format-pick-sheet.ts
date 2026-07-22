import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService, EngagementStatus } from '../engagement.service';
import { parseHhmm, hhmmFormatValidator } from '../hhmm';

export interface FormatPickSheetData {
  bookId: string;
  title: string;
  cover_url: string | null;
  default_audio_minutes: number | null;
  /** Offer a status choice before format when there's more than one to choose from
   * (e.g. from search's Add/Import flow). Omitted or single-entry: skip straight to
   * format picking and use that one status, defaulting to 'reading'. */
  statuses?: EngagementStatus[];
  /** Label for the bail-out button. Defaults to 'Cancel'. */
  cancelLabel?: string;
}

const FORMATS = [
  { value: 'print', label: 'Print' },
  { value: 'digital', label: 'Digital' },
  { value: 'audio', label: 'Audio' },
] as const;

const STATUS_LABEL: Record<EngagementStatus, string> = {
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'DNF',
};

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
      @if (mode() === 'choosingStatus') {
        @for (option of data.statuses; track option) {
          <button
            mat-stroked-button
            style="width: 100%;"
            [attr.aria-label]="'Add ' + data.title + ' as ' + statusLabel(option)"
            (click)="chooseStatus(option)"
          >
            {{ statusLabel(option) }}
          </button>
        }
      }
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
      }
      @if (mode() === 'collectingLength') {
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
      @if (mode() === 'choosingStatus' || mode() === 'picking') {
        <button mat-button style="width: 100%;" [disabled]="submitting()" (click)="close()">
          {{ data.cancelLabel ?? 'Cancel' }}
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
  protected readonly mode = signal<'choosingStatus' | 'picking' | 'collectingLength'>(
    (this.data.statuses?.length ?? 0) > 1 ? 'choosingStatus' : 'picking',
  );
  protected readonly status = signal<EngagementStatus>(this.data.statuses?.[0] ?? 'reading');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly lengthControl = new FormControl<string | null>(null, [
    Validators.required,
    hhmmFormatValidator(),
  ]);

  protected statusLabel(status: EngagementStatus): string {
    return STATUS_LABEL[status];
  }

  protected chooseStatus(option: EngagementStatus): void {
    this.status.set(option);
    this.mode.set('picking');
  }

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

    this.engagementService
      .markReading(this.data.bookId, format, audioLengthMinutes, this.status())
      .subscribe({
        next: () => {
          this.engagementService.reloadEngagements();
          this.close(this.status());
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('Failed to start reading. Please try again.');
        },
      });
  }

  protected close(result?: EngagementStatus): void {
    this.dialogRef?.close(result);
    this.bottomSheetRef?.dismiss(result);
  }
}
