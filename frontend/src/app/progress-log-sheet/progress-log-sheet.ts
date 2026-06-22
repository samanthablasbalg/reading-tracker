import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { EngagementService } from '../engagement.service';

export interface ProgressLogSheetData {
  engagementId: string;
  title: string;
  cover_url: string | null;
  resume_from_page: number;
  default_page_count: number | null;
}

@Component({
  selector: 'app-progress-log-sheet',
  imports: [
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
        <img
          [src]="data.cover_url"
          [alt]="data.title + ' cover'"
          style="height: 120px; width: auto;"
        />
      }
      <h2 mat-dialog-title style="margin: 0; text-align: center;">{{ data.title }}</h2>
      <mat-form-field style="width: 100%;">
        <mat-label>Current page</mat-label>
        <input matInput type="number" [attr.min]="effectiveMin" [formControl]="pageControl" />
        @if (pageControl.hasError('min')) {
          <mat-error>Must be greater than page {{ data.resume_from_page }}</mat-error>
        }
        @if (pageControl.hasError('max')) {
          <mat-error>Cannot exceed {{ data.default_page_count }} pages</mat-error>
        }
      </mat-form-field>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (mode() === 'idle') {
        <button
          mat-flat-button
          style="width: 100%;"
          [disabled]="pageControl.invalid || submitting()"
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
      const discarding = this.pageControl.value !== this.data.resume_from_page;
      return {
        prompt: discarding
          ? `Finish and discard the page you entered (${this.pageControl.value})?`
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

  constructor() {
    effect(() => {
      if (this.mode() === 'idle') {
        this.pageControl.enable();
      } else {
        this.pageControl.disable();
      }
    });
  }

  protected save(): void {
    if (this.pageControl.invalid || this.saving()) {
      return;
    }
    const page = this.pageControl.value as number;
    this.saving.set(true);
    this.error.set(null);

    this.engagementService.logProgress(this.data.engagementId, { current_page: page }).subscribe({
      next: () => {
        const completion_pct = this.data.default_page_count
          ? Math.min(100, Math.round((page / this.data.default_page_count) * 100))
          : null;
        this.engagementService.patchEngagementInPlace(this.data.engagementId, {
          resume_from_page: page,
          completion_pct,
        });
        this.close();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to save. Please try again.');
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
