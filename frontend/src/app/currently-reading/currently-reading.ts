import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Engagement, EngagementService } from '../engagement.service';
import {
  ProgressLogSheetComponent,
  ProgressLogSheetData,
} from '../progress-log-sheet/progress-log-sheet';

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
          @if (engagement.resume_from_page > 0) {
            <span matListItemLine>Resuming from p.{{ engagement.resume_from_page }}</span>
          }
          @if (engagement.completion_pct !== null) {
            <span matListItemLine>{{ engagement.completion_pct }}% complete</span>
          }
          <button
            mat-stroked-button
            [attr.aria-label]="'Log progress for ' + engagement.book.title"
            (click)="openLogSheet(engagement)"
          >
            Log progress
          </button>
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
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly engagements = toSignal(this.engagementService.engagements('reading'), {
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

  protected openLogSheet(engagement: Engagement): void {
    const data: ProgressLogSheetData = {
      engagementId: engagement.id,
      title: engagement.book.title,
      cover_url: engagement.cover_url,
      resume_from_page: engagement.resume_from_page,
      default_page_count: engagement.book.default_page_count,
    };

    if (this.breakpointObserver.isMatched('(max-width: 599px)')) {
      this.bottomSheet.open(ProgressLogSheetComponent, { data });
    } else {
      this.dialog.open(ProgressLogSheetComponent, { data });
    }
  }
}
