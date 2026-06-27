import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Engagement, EngagementService, ProgressLog } from '../engagement.service';

interface HistoryData {
  engagement: Engagement;
  logs: ProgressLog[];
}

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

      .editable-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
        color: inherit;
        text-align: left;
      }

      .editable-btn:hover {
        text-decoration: underline;
      }

      .field-error {
        display: block;
        font-size: 0.75rem;
        color: var(--mat-sys-error);
        margin-top: 2px;
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
              <span matListItemTitle>
                @if (editingPageLogId() === log.id && mostRecentLogId() === log.id) {
                  <input
                    #pageInput
                    type="number"
                    class="range"
                    [value]="log.unit === 'pages' ? log.page_end : log.minute_end"
                    [attr.aria-label]="log.unit === 'pages' ? 'Edit end page' : 'Edit end minute'"
                    (blur)="submitPage(log, pageInput.value)"
                    (keydown.enter)="pageInput.blur()"
                    (keydown.escape)="cancelEditPage()"
                  />
                  @if (pageError()) {
                    <span class="field-error">{{ pageError() }}</span>
                  }
                } @else if (mostRecentLogId() === log.id) {
                  <button
                    type="button"
                    class="range editable-btn"
                    aria-label="Edit progress range"
                    (click)="startEditPage(log.id)"
                  >
                    {{ formatRange(log) }}
                  </button>
                } @else {
                  <span class="range">{{ formatRange(log) }}</span>
                }
              </span>
              <span matListItemLine>
                @if (editingDateLogId() === log.id) {
                  <input
                    #dateInput
                    type="date"
                    [value]="log.logged_at.substring(0, 10)"
                    aria-label="Edit log date"
                    (blur)="submitDate(log, dateInput.value)"
                    (keydown.enter)="dateInput.blur()"
                    (keydown.escape)="cancelEditDate()"
                  />
                  @if (dateError()) {
                    <span class="field-error">{{ dateError() }}</span>
                  }
                } @else {
                  <button
                    type="button"
                    class="editable-btn"
                    [attr.aria-label]="'Edit date: ' + log.logged_at"
                    (click)="startEditDate(log.id)"
                  >
                    {{ log.logged_at | date: 'mediumDate' : 'UTC' }}
                  </button>
                }
              </span>
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

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  protected readonly editingDateLogId = signal<string | null>(null);
  protected readonly editingPageLogId = signal<string | null>(null);
  protected readonly dateError = signal<string | null>(null);
  protected readonly pageError = signal<string | null>(null);

  protected readonly data = toSignal<HistoryData>(
    combineLatest([this.route.paramMap, this.refresh$]).pipe(
      switchMap(([params]) => {
        const id = params.get('id')!;
        return forkJoin({
          engagement: this.engagementService.getEngagement(id),
          logs: this.engagementService.getProgressLogs(id),
        });
      }),
    ),
  );

  protected readonly mostRecentLogId = computed(() => {
    const d = this.data();
    if (!d || d.logs.length === 0) return null;
    return d.logs[d.logs.length - 1].id;
  });

  protected back(): void {
    this.location.back();
  }

  protected startEditDate(logId: string): void {
    this.editingDateLogId.set(logId);
    this.dateError.set(null);
  }

  protected cancelEditDate(): void {
    this.editingDateLogId.set(null);
    this.dateError.set(null);
  }

  protected submitDate(log: ProgressLog, value: string): void {
    if (this.editingDateLogId() !== log.id) return;
    if (!value) {
      this.cancelEditDate();
      return;
    }
    this.engagementService
      .patchProgressLog(log.engagement_id, log.id, { logged_at: value })
      .subscribe({
        next: () => {
          this.editingDateLogId.set(null);
          this.dateError.set(null);
          this.refresh$.next();
        },
        error: (err) => {
          if (err.status === 409) {
            this.dateError.set(err.error?.detail ?? 'Conflict');
          }
        },
      });
  }

  protected startEditPage(logId: string): void {
    this.editingPageLogId.set(logId);
    this.pageError.set(null);
  }

  protected cancelEditPage(): void {
    this.editingPageLogId.set(null);
    this.pageError.set(null);
  }

  protected submitPage(log: ProgressLog, value: string): void {
    if (this.editingPageLogId() !== log.id) return;
    const num = Number(value);
    if (!value || isNaN(num)) {
      this.cancelEditPage();
      return;
    }
    const patch = log.unit === 'pages' ? { page_end: num } : { minute_end: num };
    this.engagementService.patchProgressLog(log.engagement_id, log.id, patch).subscribe({
      next: () => {
        this.editingPageLogId.set(null);
        this.pageError.set(null);
        this.refresh$.next();
      },
      error: (err) => {
        if (err.status === 409) {
          this.pageError.set(err.error?.detail ?? 'Conflict');
        }
      },
    });
  }
}
