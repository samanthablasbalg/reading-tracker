import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Engagement, EngagementService, ProgressLog } from '../engagement.service';

interface HistoryData { engagement: Engagement; logs: ProgressLog[] }

function formatRange(log: ProgressLog): string {
  if (log.unit === 'pages') {
    return `pp. ${log.page_start ?? 0}–${log.page_end ?? 0}`;
  }
  return `min. ${log.minute_start ?? 0}–${log.minute_end ?? 0}`;
}

@Component({
  selector: 'app-engagement-history',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatListModule],
  styles: [
    `
      .page {
        padding: 16px;
        max-width: 640px;
        margin: 0 auto;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .title {
        font-size: 1.25rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .author {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 8px;
      }

      .dates {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 16px;
      }

      .range {
        font-variant-numeric: tabular-nums;
      }

      .new-badge {
        font-size: 0.75rem;
        color: var(--mat-sys-primary);
        font-weight: 500;
      }
    `,
  ],
  template: `
    @if (data(); as d) {
      <div class="page">
        <div class="header">
          <button mat-icon-button (click)="back()" aria-label="Go back">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <span class="title">{{ d.engagement.book.title }}</span>
        </div>
        <div class="author">{{ d.engagement.book.authors.map((a) => a.name).join(', ') }}</div>
        <div class="dates">
          Started:
          {{
            d.engagement.started_on ? (d.engagement.started_on | date: 'mediumDate' : 'UTC') : '—'
          }}
          &nbsp;·&nbsp; Finished:
          {{
            d.engagement.finished_on ? (d.engagement.finished_on | date: 'mediumDate' : 'UTC') : '—'
          }}
        </div>

        <mat-list>
          @for (log of d.logs; track log.id) {
            <mat-list-item>
              <span matListItemTitle class="range">{{ formatRange(log) }}</span>
              <span matListItemLine>{{ log.logged_at | date: 'mediumDate' : 'UTC' }}</span>
              @if (log.new_ground) {
                <span matListItemMeta class="new-badge">new</span>
              }
            </mat-list-item>
          } @empty {
            <p>No progress logged yet.</p>
          }
        </mat-list>
      </div>
    }
  `,
})
export class EngagementHistoryComponent {
  protected readonly formatRange = formatRange;

  private readonly route = inject(ActivatedRoute);
  private readonly engagementService = inject(EngagementService);
  private readonly location = inject(Location);

  protected readonly data = toSignal<HistoryData>(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id')!;
        return forkJoin({
          engagement: this.engagementService.getEngagement(id),
          logs: this.engagementService.getProgressLogs(id),
        });
      }),
    ),
  );

  protected back(): void {
    this.location.back();
  }
}
