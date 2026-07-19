import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService, localDateString } from '../engagement.service';
import { formatIcon } from '../format-icon';
import {
  parseHhmm,
  formatHhmm,
  hhmmFormatValidator,
  hhmmMinValidator,
  hhmmMaxValidator,
} from '../hhmm';

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

/** The day before `today` (an ISO `logDate()` value), for the "Yesterday" chip. */
function yesterdayDateString(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day - 1));
}

@Component({
  selector: 'app-progress-log-sheet',
  imports: [NgOptimizedImage, ReactiveFormsModule, MatButtonModule, MatIconModule, MatDialogTitle],
  templateUrl: './progress-log-sheet.html',
})
export class ProgressLogSheetComponent {
  protected readonly dialogRef = inject(MatDialogRef, { optional: true });
  protected readonly bottomSheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: ProgressLogSheetData =
    inject<ProgressLogSheetData>(MAT_DIALOG_DATA, { optional: true }) ??
    inject<ProgressLogSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly engagementService = inject(EngagementService);

  protected readonly formatIcon = formatIcon;
  protected readonly formatHhmm = formatHhmm;
  protected readonly isAudio = this.data.formats.includes('audio');
  protected readonly defaultValue = this.isAudio
    ? this.data.default_audio_minutes
    : this.data.default_page_count;
  protected readonly currentValueProperty = this.isAudio ? 'current_minute' : 'current_page';
  protected readonly resumeFromProperty = this.isAudio ? 'resume_from_minute' : 'resume_from_page';
  protected readonly entryText = this.isAudio ? 'timestamp' : 'page';

  /** The static "From" reference shown in the rangebox — never edited in this build. */
  protected readonly fromDisplay = this.isAudio
    ? formatHhmm(this.data.resume_from_minute)
    : String(this.data.resume_from_page);

  protected readonly toLabelId = 'progress-log-to-label';
  protected readonly valueErrorId = 'progress-log-value-error';

  /** Whether the To field currently has focus — used to hide its error while actively editing. */
  protected readonly valueFocused = signal(false);

  protected readonly todayLocal = localDateString();
  protected readonly yesterdayLocal = yesterdayDateString(this.todayLocal);
  protected readonly logDate = signal(this.todayLocal);
  protected readonly showDatePicker = signal(false);

  protected readonly isToday = computed(() => this.logDate() === this.todayLocal);
  protected readonly isYesterday = computed(() => this.logDate() === this.yesterdayLocal);
  protected readonly isCustomDate = computed(() => !this.isToday() && !this.isYesterday());
  /** "Jul 5"-style label for the picked-date chip once it's neither today nor yesterday. */
  protected readonly pickedDateLabel = computed(() => {
    if (!this.isCustomDate()) return null;
    const [year, month, day] = this.logDate().split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  });

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
        ? this.minuteControl.value != null && this.minuteControl.value !== ''
        : this.pageControl.value != null;
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

  protected readonly pageControl = new FormControl<number | null>(null, {
    validators: [
      Validators.required,
      Validators.min(this.effectiveMin),
      ...(this.data.default_page_count != null
        ? [Validators.max(this.data.default_page_count)]
        : []),
    ],
  });

  protected readonly minuteControl = new FormControl<string | null>(null, {
    validators: [
      Validators.required,
      hhmmFormatValidator(),
      hhmmMinValidator(this.data.resume_from_minute),
      ...(this.data.default_audio_minutes !== null
        ? [hhmmMaxValidator(this.data.default_audio_minutes)]
        : []),
    ],
  });

  protected get saveDisabled(): boolean {
    if (this.isAudio) {
      return this.minuteControl.invalid;
    }
    return this.pageControl.invalid;
  }

  protected get valueInvalid(): boolean {
    if (this.valueFocused()) return false;
    return this.isAudio ? this.minuteControl.invalid : this.pageControl.invalid;
  }

  protected get valueErrorMessage(): string | null {
    if (!this.valueInvalid) return null;
    if (this.isAudio) {
      if (this.minuteControl.hasError('hhmm')) return 'Enter a time in HH:MM format';
      if (this.minuteControl.hasError('min')) {
        return `Must be after ${formatHhmm(this.data.resume_from_minute)}`;
      }
      if (this.minuteControl.hasError('max')) {
        return `Cannot exceed ${formatHhmm(this.data.default_audio_minutes!)}`;
      }
      return null;
    }
    if (this.pageControl.hasError('min')) {
      return `Must be greater than page ${this.data.resume_from_page}`;
    }
    if (this.pageControl.hasError('max')) {
      return `Cannot exceed ${this.data.default_page_count} pages`;
    }
    return null;
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

  /** Returns the Tailwind classes for a date chip's on/off look. */
  protected chipClass(active: boolean): string {
    return active
      ? 'bg-primary/10 border-primary/30 text-primary'
      : 'bg-surface-2 border-border text-muted';
  }

  protected setToday(): void {
    this.showDatePicker.set(false);
    this.logDate.set(this.todayLocal);
    this.error.set(null);
  }

  protected setYesterday(): void {
    this.showDatePicker.set(false);
    this.logDate.set(this.yesterdayLocal);
    this.error.set(null);
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
