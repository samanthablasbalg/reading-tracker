import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Engagement, EngagementService } from '../engagement.service';
import {
  ProgressLogSheetComponent,
  ProgressLogSheetData,
} from '../progress-log-sheet/progress-log-sheet';
import { formatIcon } from '../format-icon';

@Component({
  selector: 'app-currently-reading',
  imports: [
    NgOptimizedImage,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RouterLink,
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

      .author-row {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
      }

      .author {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .format-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        color: var(--mat-sys-on-surface-variant);
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
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .push-right {
        margin-left: auto;
      }
    `,
  ],
  template: `
    <div class="book-list" role="list">
      @for (engagement of engagements(); track engagement.id) {
        <mat-card appearance="outlined" role="listitem" [attr.aria-label]="engagement.book.title">
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

              <div class="text">
                <span class="title font-serif">{{ engagement.book.title }}</span>
                <div class="author-row">
                  <span class="author">{{
                    engagement.book.authors.map((a) => a.name).join(', ')
                  }}</span>
                  @if (engagement.formats[0]) {
                    <mat-icon
                      class="format-icon"
                      aria-hidden="false"
                      [aria-label]="'Format: ' + engagement.formats[0]"
                      >{{ formatIcon(engagement.formats[0]) }}</mat-icon
                    >
                  }
                </div>
              </div>
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
              <div class="actions" [class.push-right]="!showText()">
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
                <button
                  mat-stroked-button
                  [attr.aria-label]="'Log progress for ' + engagement.book.title"
                  (click)="openLogSheet(engagement)"
                >
                  Log progress
                </button>
                <button
                  mat-icon-button
                  [routerLink]="['/engagement', engagement.id]"
                  [attr.aria-label]="'View history for ' + engagement.book.title"
                >
                  <mat-icon>history</mat-icon>
                </button>
                <button
                  mat-icon-button
                  [attr.aria-label]="'Delete ' + engagement.book.title"
                  (click)="deleteEngagement(engagement)"
                >
                  <mat-icon>delete</mat-icon>
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
  protected readonly formatIcon = formatIcon;

  private readonly engagementService = inject(EngagementService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly engagements = toSignal(this.engagementService.engagements('reading'), {
    initialValue: [],
  });
  protected readonly showText = toSignal(
    this.breakpointObserver.observe('(min-width: 600px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );
  protected readonly showBar = toSignal(
    this.breakpointObserver.observe('(min-width: 781px)').pipe(map((r) => r.matches)),
    { initialValue: true },
  );

  /** True while the mobile log sheet is open. Read by `logSheetOpenGuard` so the browser
   *  back button closes the sheet instead of navigating away from this route — Router
   *  consults `canDeactivate` guards even for popstate-triggered navigations, which makes
   *  this a reliable way to intercept the back button without racing Router's own
   *  popstate listener. */
  readonly logSheetOpen = signal(false);
  private openBottomSheetRef: MatBottomSheetRef<ProgressLogSheetComponent> | null = null;

  protected coverUrl(engagement: Engagement): string | null {
    return engagement.cover_url;
  }

  protected openLogSheet(engagement: Engagement): void {
    const data: ProgressLogSheetData = {
      engagementId: engagement.id,
      title: engagement.book.title,
      cover_url: this.coverUrl(engagement),
      formats: engagement.formats,
      resume_from_page: engagement.resume_from_page,
      resume_from_minute: engagement.resume_from_minute,
      default_page_count: engagement.book.default_page_count,
      default_audio_minutes: engagement.book.default_audio_minutes,
    };

    if (this.breakpointObserver.isMatched('(max-width: 599px)')) {
      const ref = this.bottomSheet.open(ProgressLogSheetComponent, { data, autoFocus: 'dialog' });
      this.openBottomSheetRef = ref;
      this.logSheetOpen.set(true);
      ref.afterDismissed().subscribe(() => {
        this.logSheetOpen.set(false);
        this.openBottomSheetRef = null;
      });
    } else {
      this.dialog.open(ProgressLogSheetComponent, { data, autoFocus: 'dialog' });
    }
  }

  /** Called by `logSheetOpenGuard` when the back button tries to navigate away while the
   *  mobile log sheet is open. */
  closeLogSheet(): void {
    this.openBottomSheetRef?.dismiss();
  }

  protected deleteEngagement(engagement: Engagement): void {
    if (!confirm("Delete this engagement? This can't be undone.")) {
      return;
    }
    this.engagementService.deleteEngagement(engagement.id).subscribe(() => {
      this.engagementService.reloadEngagements();
    });
  }
}
