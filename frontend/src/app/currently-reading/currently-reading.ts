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
          <span matListItemLine>Started {{ engagement.started_on | date: 'mediumDate' }}</span>
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

  protected readonly engagements = toSignal(this.engagementService.readingEngagements$, {
    initialValue: [],
  });
  protected readonly markingId = signal<string | null>(null);
  protected readonly markErrorId = signal<string | null>(null);

  protected markButtonLabel(engagementId: string): string {
    if (this.markingId() === engagementId) return 'Marking…';
    if (this.markErrorId() === engagementId) return 'Error';
    return 'Mark as finished';
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
}
