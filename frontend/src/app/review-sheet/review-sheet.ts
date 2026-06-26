import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EngagementService, Review } from '../engagement.service';

export interface ReviewSheetData {
  engagementId: string;
  title: string;
  cover_url: string | null;
  review: Review | null;
}

@Component({
  selector: 'app-review-sheet',
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

      <div style="width: 100%;">
        <p id="rating-label" style="margin: 0 0 4px 0;">Rating (optional)</p>
        <div
          style="display: flex; align-items: center; gap: 8px;"
          role="group"
          aria-labelledby="rating-label"
        >
          <select
            [formControl]="wholeControl"
            [attr.aria-label]="'Whole number rating for ' + data.title"
          >
            <option [ngValue]="null">—</option>
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <option [ngValue]="n">{{ n }}</option>
            }
          </select>
          <span aria-hidden="true">.</span>
          <select
            [formControl]="fractionControl"
            [attr.aria-label]="'Fractional rating for ' + data.title"
          >
            <option [ngValue]="0">00</option>
            <option [ngValue]="0.25" [disabled]="wholeControl.value === 5">25</option>
            <option [ngValue]="0.5" [disabled]="wholeControl.value === 5">50</option>
            <option [ngValue]="0.75" [disabled]="wholeControl.value === 5">75</option>
          </select>
          <span aria-hidden="true">★</span>
        </div>
      </div>

      <mat-form-field style="width: 100%;">
        <mat-label>Review (optional)</mat-label>
        <textarea
          matInput
          rows="4"
          [formControl]="bodyControl"
          [attr.aria-label]="'Review text for ' + data.title"
        ></textarea>
      </mat-form-field>

      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      <button
        mat-flat-button
        style="width: 100%;"
        [disabled]="saving()"
        (click)="save()"
        [attr.aria-label]="'Save review for ' + data.title"
      >
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
      <button mat-button style="width: 100%;" [disabled]="saving()" (click)="close()">
        Cancel
      </button>
    </div>
  `,
})
export class ReviewSheetComponent {
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly bottomSheetRef = inject(MatBottomSheetRef, { optional: true });
  protected readonly data: ReviewSheetData =
    inject<ReviewSheetData>(MAT_DIALOG_DATA, { optional: true }) ??
    inject<ReviewSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly engagementService = inject(EngagementService);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly wholeControl: FormControl<number | null>;
  protected readonly fractionControl: FormControl<number>;
  protected readonly bodyControl: FormControl<string>;

  constructor() {
    const existingRating =
      this.data.review?.rating != null ? parseFloat(this.data.review.rating) : null;
    const whole = existingRating !== null ? Math.floor(existingRating) : null;
    const fraction = existingRating !== null ? existingRating - Math.floor(existingRating) : 0;

    this.wholeControl = new FormControl<number | null>(whole);
    this.fractionControl = new FormControl<number>(fraction, { nonNullable: true });
    this.bodyControl = new FormControl<string>(this.data.review?.body ?? '', {
      nonNullable: true,
    });

    if (whole === null) {
      this.fractionControl.disable();
    }

    this.wholeControl.valueChanges.subscribe((val) => {
      if (val === null) {
        this.fractionControl.disable();
      } else {
        this.fractionControl.enable();
        if (val === 5) {
          this.fractionControl.setValue(0);
        }
      }
    });
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const whole = this.wholeControl.value;
    const rating = whole !== null ? whole + this.fractionControl.value : null;
    const bodyRaw = this.bodyControl.value.trim();
    const body = bodyRaw === '' ? null : bodyRaw;

    this.engagementService.upsertReview(this.data.engagementId, rating, body).subscribe({
      next: () => {
        this.engagementService.reloadEngagements();
        this.close();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to save. Please try again.');
      },
    });
  }

  protected close(): void {
    this.dialogRef?.close();
    this.bottomSheetRef?.dismiss();
  }
}
