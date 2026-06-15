import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { EngagementService } from '../engagement.service';

@Component({
  selector: 'app-currently-reading',
  imports: [MatListModule, MatButtonModule, DatePipe],
  template: `
    <mat-list>
      @for (engagement of engagements(); track engagement.id) {
        <mat-list-item>
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
          </span>
          <span matListItemLine
            >Started {{ engagement.started_on | date: 'mediumDate' : 'UTC' }}</span
          >
          <span matListItemLine>Resuming from p.{{ engagement.resume_from_page }}</span>
          @if (engagement.completion_pct !== null) {
            <span matListItemLine>{{ engagement.completion_pct }}% complete</span>
          }
          <span matListItemLine>
            <input
              type="number"
              min="1"
              [value]="pageInputs()[engagement.id] ?? ''"
              (input)="setPageInput(engagement.id, $event)"
              [attr.aria-label]="'Current page for ' + engagement.book.title"
            />
            <button
              mat-stroked-button
              [disabled]="loggingId() === engagement.id"
              [attr.aria-label]="'Log progress for ' + engagement.book.title"
              (click)="logProgress(engagement.id)"
            >
              {{ logButtonLabel(engagement.id) }}
            </button>
          </span>
          <button
            mat-stroked-button
            matListItemMeta
            [disabled]="markingId() === engagement.id"
            [attr.aria-label]="'Mark ' + engagement.book.title + ' as finished'"
            (click)="markFinished(engagement.id)"
          >
            {{ markButtonLabel(engagement.id) }}
          </button>
        </mat-list-item>
      } @empty {
        <p>No books in progress.</p>
      }
    </mat-list>
  `,
})
export class CurrentlyReadingComponent {
  private readonly engagementService = inject(EngagementService);

  protected readonly engagements = toSignal(this.engagementService.engagements('reading'), {
    initialValue: [],
  });
  protected readonly markingId = signal<string | null>(null);
  protected readonly markErrorId = signal<string | null>(null);
  protected readonly loggingId = signal<string | null>(null);
  protected readonly logErrorId = signal<string | null>(null);
  protected readonly pageInputs = signal<Record<string, number>>({});

  protected markButtonLabel(engagementId: string): string {
    if (this.markingId() === engagementId) return 'Marking…';
    if (this.markErrorId() === engagementId) return 'Error';
    return 'Mark as finished';
  }

  protected logButtonLabel(engagementId: string): string {
    if (this.loggingId() === engagementId) return 'Logging…';
    if (this.logErrorId() === engagementId) return 'Error';
    return 'Log progress';
  }

  protected setPageInput(engagementId: string, event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.pageInputs.update((inputs) => ({ ...inputs, [engagementId]: value }));
  }

  protected markFinished(engagementId: string): void {
    this.markingId.set(engagementId);
    this.markErrorId.set(null);

    this.engagementService.markFinished(engagementId).subscribe({
      next: () => {
        this.markingId.set(null);
        this.engagementService.reloadEngagements();
      },
      error: () => {
        this.markingId.set(null);
        this.markErrorId.set(engagementId);
      },
    });
  }

  protected logProgress(engagementId: string): void {
    const page = this.pageInputs()[engagementId];
    if (!page) return;

    this.loggingId.set(engagementId);
    this.logErrorId.set(null);

    this.engagementService.logProgress(engagementId, page).subscribe({
      next: () => {
        this.loggingId.set(null);
        this.engagementService.reloadEngagements();
      },
      error: () => {
        this.loggingId.set(null);
        this.logErrorId.set(engagementId);
      },
    });
  }
}
