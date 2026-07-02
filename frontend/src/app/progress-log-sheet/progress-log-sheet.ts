import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService, localDateString } from '../engagement.service';
import {
  parseHhmm,
  formatHhmm,
  hhmmFormatValidator,
  hhmmMinValidator,
  hhmmMaxValidator,
} from '../hhmm';

class DirtyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && control.dirty);
  }
}

export interface ProgressLogSheetData {
  engagementId: string;
  title: string;
  cover_url: string | null;
  formats: string[];
  resume_from_page: number;
  resume_from_minute: number;
  default_page_count: number | null;
  default_audio_minutes: number | null;
}

@Component({
  selector: 'app-progress-log-sheet',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDialogTitle,
  ],
  template: `
    <div
      style="display: flex; flex-direction: column; align-items: center; padding: 16px; gap: 12px;"
    >
      @if (data.cover_url) {
        <img
          [src]="data.cover_url"
          [alt]="data.title + ' cover'"
          style="height: 120px; width: auto;"
        />
      }
      <h2 mat-dialog-title style="margin: 0; text-align: center;">{{ data.title }}</h2>
      @if (isAudio) {
        <mat-form-field style="width: 100%;" hideRequiredMarker>
          <mat-label>Current position</mat-label>
          <input
            matInput
            [formControl]="minuteControl"
            [errorStateMatcher]="errorMatcher"
            placeholder="HH:MM"
          />
          <button
            matSuffix
            type="button"
            mat-icon-button
            aria-label="Log for a different day"
            (click)="toggleDatePicker()"
          >
            <mat-icon>event</mat-icon>
          </button>
          @if (minuteControl.hasError('hhmm')) {
            <mat-error>Enter a time in HH:MM format</mat-error>
          }
          @if (minuteControl.hasError('min')) {
            <mat-error>Must be after {{ formatHhmm(data.resume_from_minute) }}</mat-error>
          }
          @if (minuteControl.hasError('max')) {
            <mat-error>Cannot exceed {{ formatHhmm(data.default_audio_minutes!) }}</mat-error>
          }
        </mat-form-field>
      } @else {
        <mat-form-field style="width: 100%;" hideRequiredMarker>
          <mat-label>Current page</mat-label>
          <input
            matInput
            type="number"
            [attr.min]="effectiveMin"
            [formControl]="pageControl"
            [errorStateMatcher]="errorMatcher"
          />
          <button
            matSuffix
            type="button"
            mat-icon-button
            aria-label="Log for a different day"
            (click)="toggleDatePicker()"
          >
            <mat-icon>event</mat-icon>
          </button>
          @if (pageControl.hasError('min')) {
            <mat-error>Must be greater than page {{ data.resume_from_page }}</mat-error>
          }
          @if (pageControl.hasError('max')) {
            <mat-error>Cannot exceed {{ data.default_page_count }} pages</mat-error>
          }
        </mat-form-field>
      }
      @if (showDatePicker()) {
        <mat-form-field style="width: 100%;">
          <mat-label>Log date</mat-label>
          <input
            matInput
            type="date"
            [value]="logDate()"
            [attr.max]="todayLocal"
            aria-label="Log date"
            (change)="onDateChange($event)"
          />
        </mat-form-field>
      }
      @if (error()) {
        <p role="alert" style="color: var(--mat-sys-error); margin: 0;">{{ error() }}</p>
      }
      @if (mode() === 'idle') {
        <button
          mat-flat-button
          style="width: 100%;"
          [disabled]="saveDisabled || submitting()"
          (click)="save()"
          [attr.aria-label]="'Save progress for ' + data.title"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
        <button
          mat-button
          style="width: 100%;"
          [disabled]="submitting()"
          (click)="onFinish()"
          [attr.aria-label]="'Mark ' + data.title + ' as finished'"
        >
          I finished the book
        </button>
        <button
          mat-button
          style="width: 100%;"
          [disabled]="submitting()"
          (click)="onDnf()"
          [attr.aria-label]="'Mark ' + data.title + ' as DNF'"
        >
          I'm giving up on this book
        </button>
        <button mat-button style="width: 100%;" (click)="close()">Cancel</button>
      } @else {
        <p style="text-align: center; margin: 0;">
          {{ confirmText().prompt }}
        </p>
        <button
          mat-flat-button
          style="width: 100%;"
          [disabled]="submitting()"
          (click)="onConfirm()"
          [attr.aria-label]="confirmText().ariaLabel"
        >
          {{ submitting() ? confirmText().submittingLabel : confirmText().label }}
        </button>
        <button
          mat-button
          style="width: 100%;"
          [disabled]="submitting()"
          (click)="mode.set('idle')"
        >
          Go back
        </button>
      }
    </div>
  `,
})
export class ProgressLogSheetComponent {
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly bottomSheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: ProgressLogSheetData =
    inject<ProgressLogSheetData>(MAT_DIALOG_DATA, { optional: true }) ??
    inject<ProgressLogSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly engagementService = inject(EngagementService);

  protected readonly formatHhmm = formatHhmm;
  protected readonly errorMatcher = new DirtyErrorStateMatcher();
  protected readonly isAudio = this.data.formats.includes('audio');
  protected readonly defaultValue = this.isAudio
    ? this.data.default_audio_minutes
    : this.data.default_page_count;
  protected readonly currentValueProperty = this.isAudio ? 'current_minute' : 'current_page';
  protected readonly resumeFromProperty = this.isAudio ? 'resume_from_minute' : 'resume_from_page';
  protected readonly entryText = this.isAudio ? 'timestamp' : 'page';

  protected readonly todayLocal = localDateString();
  protected readonly logDate = signal(this.todayLocal);
  protected readonly showDatePicker = signal(false);

  protected readonly saving = signal(false);
  protected readonly mode = signal<
    'idle' | 'finishing' | 'dnfing' | 'confirmingFinish' | 'confirmingDnf'
  >('idle');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = computed(
    () => this.mode() === 'finishing' || this.mode() === 'dnfing' || this.saving(),
  );
  protected readonly confirmText = computed(() => {
    if (this.mode() === 'confirmingFinish' || this.mode() === 'finishing') {
      const discarding = this.isAudio
        ? this.minuteControl.value !== formatHhmm(this.data.resume_from_minute)
        : this.pageControl.value !== this.data.resume_from_page;
      const enteredValue = this.isAudio ? this.minuteControl.value : this.pageControl.value;
      return {
        prompt: discarding
          ? `Finish and discard the ${this.entryText} you entered (${enteredValue})?`
          : `Mark "${this.data.title}" as finished?`,
        label: 'Finish',
        ariaLabel: 'Confirm finish ' + this.data.title,
        submittingLabel: 'Finishing...',
      };
    } else {
      return {
        prompt: `Give up on ${this.data.title}?`,
        label: 'Give Up',
        ariaLabel: 'Confirm dnf ' + this.data.title,
        submittingLabel: 'DNFing...',
      };
    }
  });

  protected readonly effectiveMin: number =
    this.data.default_page_count != null
      ? Math.min(this.data.resume_from_page + 1, this.data.default_page_count)
      : this.data.resume_from_page + 1;

  protected readonly pageControl = new FormControl<number | null>(this.data.resume_from_page, {
    validators: [
      Validators.required,
      Validators.min(this.effectiveMin),
      ...(this.data.default_page_count != null
        ? [Validators.max(this.data.default_page_count)]
        : []),
    ],
  });

  protected readonly minuteControl = new FormControl<string | null>(
    formatHhmm(this.data.resume_from_minute),
    {
      validators: [
        Validators.required,
        hhmmFormatValidator(),
        hhmmMinValidator(this.data.resume_from_minute),
        ...(this.data.default_audio_minutes !== null
          ? [hhmmMaxValidator(this.data.default_audio_minutes)]
          : []),
      ],
    },
  );

  protected get saveDisabled(): boolean {
    if (this.isAudio) {
      return this.minuteControl.invalid;
    }
    return this.pageControl.invalid;
  }

  constructor() {
    this.pageControl.valueChanges.subscribe(() => this.error.set(null));
    this.minuteControl.valueChanges.subscribe(() => this.error.set(null));

    effect(() => {
      if (this.mode() === 'idle') {
        if (this.isAudio) {
          this.minuteControl.enable({ emitEvent: false });
        } else {
          this.pageControl.enable({ emitEvent: false });
        }
      } else {
        if (this.isAudio) {
          this.minuteControl.disable({ emitEvent: false });
        } else {
          this.pageControl.disable({ emitEvent: false });
        }
      }
    });
  }

  protected toggleDatePicker(): void {
    const opening = !this.showDatePicker();
    this.showDatePicker.set(opening);
    if (!opening) {
      this.logDate.set(this.todayLocal);
    }
  }

  protected onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.logDate.set(value);
      this.error.set(null);
    }
  }

  protected save(): void {
    if (this.saveDisabled || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const updateValue = this.isAudio
      ? parseHhmm(this.minuteControl.value)!
      : (this.pageControl.value as number);

    this.engagementService
      .logProgress(
        this.data.engagementId,
        { [this.currentValueProperty]: updateValue },
        this.logDate(),
      )
      .subscribe({
        next: () => {
          const completion_pct = this.defaultValue
            ? Math.min(100, Math.round((updateValue / this.defaultValue) * 100))
            : null;
          this.engagementService.patchEngagementInPlace(this.data.engagementId, {
            [this.resumeFromProperty]: updateValue,
            completion_pct,
          });
          this.close();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err.error?.detail ?? 'Failed to save. Please try again.');
        },
      });
  }

  protected onFinish(): void {
    if (this.mode() === 'finishing' || this.saving()) return;
    if (this.mode() !== 'confirmingFinish') {
      this.mode.set('confirmingFinish');
      return;
    }
    this.mode.set('finishing');
    this.error.set(null);

    this.engagementService.markFinished(this.data.engagementId).subscribe({
      next: () => {
        this.engagementService.reloadEngagements();
        this.close();
      },
      error: () => {
        this.mode.set('idle');
        this.error.set('Failed to finish. Please try again.');
      },
    });
  }

  protected onDnf(): void {
    if (this.mode() === 'dnfing' || this.saving()) return;
    if (this.mode() !== 'confirmingDnf') {
      this.mode.set('confirmingDnf');
      return;
    }
    this.mode.set('dnfing');
    this.error.set(null);

    this.engagementService.markDnf(this.data.engagementId).subscribe({
      next: () => {
        this.engagementService.reloadEngagements();
        this.close();
      },
      error: () => {
        this.mode.set('idle');
        this.error.set('Failed to DNF. Please try again.');
      },
    });
  }

  protected onConfirm(): void {
    if (this.mode() === 'confirmingFinish') {
      this.onFinish();
    }
    if (this.mode() === 'confirmingDnf') {
      this.onDnf();
    }
  }

  protected close(): void {
    this.dialogRef?.close();
    this.bottomSheetRef?.dismiss();
  }
}
