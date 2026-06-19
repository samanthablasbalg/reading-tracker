import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  imports: [
    NgOptimizedImage,
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  styles: [
    `
      .book-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .cover {
        width: 40px;
        height: 60px;
        flex-shrink: 0;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        background-color: var(--mat-sys-surface-variant);
      }

      .text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .title {
        font-weight: 500;
        color: var(--mat-sys-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .author {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .progress-col {
        min-width: 160px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .progress-col mat-progress-bar {
        flex: 1;
      }

      .pct {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .push-right {
        margin-left: auto;
      }
    `,
  ],
  template: `
    <div class="book-list">
      @for (engagement of engagements(); track engagement.id) {
        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="row">
              <div class="cover">
                @let url = coverUrl(engagement);
                @if (url) {
                  <img
                    [ngSrc]="url"
                    fill
                    [priority]="$first"
                    [alt]="engagement.book.title + ' cover'"
                  />
                }
              </div>
              @if (showText()) {
                <div class="text">
                  <span class="title">{{ engagement.book.title }}</span>
                  <span class="author">{{
                    engagement.book.authors.map((a) => a.name).join(', ')
                  }}</span>
                </div>
              }
              @if (showBar()) {
                <div class="progress-col">
                  @if (engagement.completion_pct !== null) {
                    <mat-progress-bar
                      [value]="engagement.completion_pct"
                      [attr.aria-label]="
                        engagement.book.title + ' progress: ' + engagement.completion_pct + '%'
                      "
                    />
                    <span class="pct">{{ engagement.completion_pct }}%</span>
                  }
                </div>
              }
              @if (!showBar() && engagement.completion_pct !== null) {
                <mat-progress-spinner
                  mode="determinate"
                  [value]="engagement.completion_pct"
                  [diameter]="36"
                  [attr.aria-label]="
                    engagement.book.title + ' progress: ' + engagement.completion_pct + '%'
                  "
                />
              }
              <div class="actions" [class.push-right]="!showText()">
                <button
                  mat-stroked-button
                  [attr.aria-label]="'Log progress for ' + engagement.book.title"
                  (click)="openLogSheet(engagement)"
                >
                  Log progress
                </button>
                <button
                  mat-stroked-button
                  [disabled]="markingId() === engagement.id"
                  [attr.aria-label]="'Mark ' + engagement.book.title + ' as finished'"
                  (click)="markFinished(engagement.id)"
                >
                  {{ markButtonLabel(engagement.id) }}
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      } @empty {
        <p>No books in progress.</p>
      }
    </div>
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

  protected readonly showText = toSignal(
    this.breakpointObserver.observe('(min-width: 600px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );
  protected readonly showBar = toSignal(
    this.breakpointObserver.observe('(min-width: 781px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );

  protected coverUrl(engagement: Engagement): string | null {
    return engagement.cover_url ?? engagement.book.default_cover_url;
  }

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
      cover_url: this.coverUrl(engagement),
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
