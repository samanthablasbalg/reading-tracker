import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InlineDateEditComponent } from '../inline-date-edit/inline-date-edit';
import { Engagement, EngagementService, localDateString, ProgressLog } from '../engagement.service';

interface HistoryData {
  engagement: Engagement;
  logs: ProgressLog[];
}

function formatMinutes(minutes: number): string {
  const m = String(minutes % 60).padStart(2, '0');
  return `${Math.floor(minutes / 60)}:${m}`;
}

function formatRange(log: ProgressLog): string {
  if (log.unit === 'pages') {
    return `pp. ${log.page_start ?? 0}–${log.page_end ?? 0}`;
  }
  return `${formatMinutes(log.minute_start ?? 0)}–${formatMinutes(log.minute_end ?? 0)}`;
}

@Component({
  selector: 'app-engagement-history',
  imports: [DatePipe, MatButtonModule, MatIconModule, InlineDateEditComponent],
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

      .log-list {
        display: flex;
        flex-direction: column;
      }

      .log-row {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .log-range {
        flex: 1;
        font-variant-numeric: tabular-nums;
      }

      .log-date {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
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

      .edit-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .field-error {
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
          <app-inline-date-edit
            [value]="d.engagement.started_on"
            label="start date"
            [(editing)]="editingStartedOn"
            [disabled]="editingFinishedOn() || editingDateLogId() !== null"
            (saved)="submitStartedOn(d.engagement.id, $event)"
          />
          &nbsp;·&nbsp; Finished:
          <app-inline-date-edit
            [value]="d.engagement.finished_on"
            label="finish date"
            [(editing)]="editingFinishedOn"
            [disabled]="editingStartedOn() || editingDateLogId() !== null"
            (saved)="submitFinishedOn(d.engagement.id, $event)"
          />
          @if (startedOnError() || finishedOnError()) {
            <div class="field-error" role="alert">{{ startedOnError() ?? finishedOnError() }}</div>
          }
        </div>

        <div class="log-list" role="list" aria-label="Progress logs">
          @for (log of d.logs; track log.id; let i = $index) {
            <div class="log-row" role="listitem" [attr.aria-label]="'Progress log ' + (i + 1)">
              <div class="log-range">
                @if (editingPageLogId() === log.id && mostRecentLogId() === log.id) {
                  <div class="edit-row">
                    <input
                      #pageInput
                      type="number"
                      [value]="log.unit === 'pages' ? log.page_end : log.minute_end"
                      [attr.max]="
                        log.unit === 'pages'
                          ? (d.engagement.book.default_page_count ?? null)
                          : (d.engagement.book.default_audio_minutes ?? null)
                      "
                      [attr.aria-label]="log.unit === 'pages' ? 'Edit end page' : 'Edit end minute'"
                      (keydown.enter)="submitPage(log, pageInput.value)"
                      (keydown.escape)="cancelEditPage()"
                    />
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Save progress"
                      (click)="submitPage(log, pageInput.value)"
                    >
                      <mat-icon>check</mat-icon>
                    </button>
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Cancel progress edit"
                      (click)="cancelEditPage()"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  @if (pageError()) {
                    <span class="field-error" role="alert">{{ pageError() }}</span>
                  }
                } @else if (mostRecentLogId() === log.id) {
                  <button
                    type="button"
                    class="editable-btn"
                    aria-label="Edit progress range"
                    (click)="startEditPage(log.id)"
                  >
                    {{ formatRange(log) }}
                  </button>
                } @else {
                  {{ formatRange(log) }}
                }
              </div>
              <div class="log-date">
                @if (editingDateLogId() === log.id) {
                  <div class="edit-row">
                    <input
                      #dateInput
                      type="date"
                      [value]="log.logged_on"
                      [attr.max]="todayLocal"
                      aria-label="Edit log date"
                      (keydown.enter)="submitDate(log, dateInput.value)"
                      (keydown.escape)="cancelEditDate()"
                    />
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Save date"
                      (click)="submitDate(log, dateInput.value)"
                    >
                      <mat-icon>check</mat-icon>
                    </button>
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Cancel date edit"
                      (click)="cancelEditDate()"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  @if (dateError()) {
                    <span class="field-error" role="alert">{{ dateError() }}</span>
                  }
                } @else {
                  <button
                    type="button"
                    class="editable-btn"
                    [attr.aria-label]="'Edit date: ' + log.logged_on"
                    (click)="startEditDate(log.id)"
                  >
                    {{ log.logged_on | date: 'mediumDate' : 'UTC' }}
                  </button>
                }
              </div>
            </div>
          } @empty {
            <p>No progress logged yet.</p>
          }
        </div>
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

  protected readonly editingStartedOn = signal(false);
  protected readonly editingFinishedOn = signal(false);
  protected readonly startedOnError = signal<string | null>(null);
  protected readonly finishedOnError = signal<string | null>(null);

  protected readonly todayLocal = localDateString();

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

  protected submitStartedOn(engagementId: string, value: string): void {
    this.engagementService.patchEngagementDates(engagementId, { started_on: value }).subscribe({
      next: () => {
        this.editingStartedOn.set(false);
        this.startedOnError.set(null);
        this.refresh$.next();
      },
      error: (err) => {
        if (err.status === 409) {
          this.startedOnError.set(err.error?.detail ?? 'Conflict');
        }
      },
    });
  }

  protected submitFinishedOn(engagementId: string, value: string): void {
    this.engagementService.patchEngagementDates(engagementId, { finished_on: value }).subscribe({
      next: () => {
        this.editingFinishedOn.set(false);
        this.finishedOnError.set(null);
        this.refresh$.next();
      },
      error: (err) => {
        if (err.status === 409) {
          this.finishedOnError.set(err.error?.detail ?? 'Conflict');
        }
      },
    });
  }

  protected startEditDate(logId: string): void {
    if (this.editingStartedOn() || this.editingFinishedOn()) return;
    this.editingDateLogId.set(logId);
    this.dateError.set(null);
  }

  protected cancelEditDate(): void {
    this.editingDateLogId.set(null);
    this.dateError.set(null);
  }

  protected submitDate(log: ProgressLog, value: string): void {
    if (this.editingDateLogId() !== log.id) return;
    if (!value || value === log.logged_on) {
      this.cancelEditDate();
      return;
    }
    this.engagementService
      .patchProgressLog(log.engagement_id, log.id, { logged_on: value })
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
