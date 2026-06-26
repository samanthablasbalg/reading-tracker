import { Component, inject } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Engagement, EngagementService, Review } from '../engagement.service';
import { formatIcon } from '../format-icon';
import { ReviewSheetComponent, ReviewSheetData } from '../review-sheet/review-sheet';

@Component({
  selector: 'app-dnf',
  imports: [MatListModule, MatIconModule, MatDivider, NgOptimizedImage, DatePipe, MatButtonModule],
  styles: [
    `
      .format-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        vertical-align: middle;
      }
    `,
  ],
  template: `
    <mat-list>
      @for (engagement of dnfEngagements(); track engagement.id) {
        <mat-list-item>
          @if (engagement.cover_url) {
            <img
              matListItemAvatar
              [ngSrc]="engagement.cover_url"
              width="40"
              height="40"
              [alt]="engagement.book.title + ' cover'"
            />
          }
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
            @if (engagement.formats[0]) {
              <mat-icon
                class="format-icon"
                aria-hidden="false"
                [aria-label]="'Format: ' + engagement.formats[0]"
                >{{ formatIcon(engagement.formats[0]) }}</mat-icon
              >
            }
          </span>
          <span matListItemLine>
            Gave up on {{ engagement.abandoned_on | date: 'mediumDate' : 'UTC' }} at
            {{ engagement.completion_pct }}%
          </span>
          @if (reviewSummary(engagement.review); as summary) {
            <span
              matListItemLine
              [attr.aria-label]="'Review summary for ' + engagement.book.title"
              >{{ summary }}</span
            >
          }
          <span matListItemMeta>
            <button
              mat-button
              (click)="openReviewSheet(engagement)"
              [attr.aria-label]="
                (engagement.review ? 'Edit' : 'Add') + ' review for ' + engagement.book.title
              "
            >
              {{ engagement.review ? 'Edit review' : 'Add review' }}
            </button>
          </span>
        </mat-list-item>
        @if (!$last) {
          <mat-divider />
        }
      } @empty {
        <p>No DNFed books yet.</p>
      }
    </mat-list>
  `,
})
export class DNFComponent {
  protected readonly formatIcon = formatIcon;

  private readonly engagementService = inject(EngagementService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly dnfEngagements = toSignal(this.engagementService.engagements('dnf'), {
    initialValue: [],
  });

  protected reviewSummary(review: Review | null): string | null {
    if (!review) return null;
    return (
      [review.rating ? `${review.rating} ★` : null, review.body].filter(Boolean).join(' · ') || null
    );
  }

  protected openReviewSheet(engagement: Engagement): void {
    const data: ReviewSheetData = {
      engagementId: engagement.id,
      title: engagement.book.title,
      cover_url: engagement.cover_url,
      review: engagement.review,
    };

    if (this.breakpointObserver.isMatched('(max-width: 599px)')) {
      this.bottomSheet.open(ReviewSheetComponent, { data });
    } else {
      this.dialog.open(ReviewSheetComponent, { data });
    }
  }
}
