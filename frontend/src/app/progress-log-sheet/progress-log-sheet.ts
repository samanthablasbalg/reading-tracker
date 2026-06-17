import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
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
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    @if (data.cover_url) {
      <img
        [src]="data.cover_url"
        [alt]="data.title + ' cover'"
        style="height: 120px; width: auto;"
      />
    }
    <h2>{{ data.title }}</h2>
    <mat-form-field>
      <mat-label>Current page</mat-label>
      <input matInput type="number" min="1" [formControl]="pageControl" />
      @if (pageControl.hasError('max')) {
        <mat-error>Cannot exceed {{ data.default_page_count }} pages</mat-error>
      }
    </mat-form-field>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <button
      mat-flat-button
      [disabled]="pageControl.invalid || saving()"
      (click)="save()"
      [attr.aria-label]="'Save progress for ' + data.title"
    >
      {{ saving() ? 'Saving…' : 'Save' }}
    </button>
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
  protected readonly error = signal<string | null>(null);
  protected readonly pageControl = new FormControl<number | null>(this.data.resume_from_page, {
    validators: [
      Validators.required,
      Validators.min(1),
      ...(this.data.default_page_count != null
        ? [Validators.max(this.data.default_page_count)]
        : []),
    ],
  });

  protected save(): void {
    if (this.pageControl.invalid || this.saving()) return;
    const page = this.pageControl.value as number;
    this.saving.set(true);
    this.error.set(null);

    this.engagementService.logProgress(this.data.engagementId, page).subscribe({
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

  private close(): void {
    this.dialogRef?.close();
    this.bottomSheetRef?.dismiss();
  }
}
