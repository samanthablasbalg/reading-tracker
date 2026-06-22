import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { EngagementService } from '../engagement.service';
import { formatIcon } from '../format-icon';

@Component({
  selector: 'app-read',
  imports: [MatListModule, MatIconModule, DatePipe],
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
      @for (engagement of finishedEngagements(); track engagement.id) {
        <mat-list-item>
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
            @if (engagement.formats[0]) {
              <mat-icon
                class="format-icon"
                [attr.aria-label]="'Format: ' + engagement.formats[0]"
                >{{ formatIcon(engagement.formats[0]) }}</mat-icon
              >
            }
          </span>
          @if (engagement.finished_on) {
            <span matListItemLine>
              Finished {{ engagement.finished_on | date: 'mediumDate' : 'UTC' }}</span
            >
          }
        </mat-list-item>
      } @empty {
        <p>No finished books yet.</p>
      }
    </mat-list>
  `,
})
export class ReadComponent {
  protected readonly formatIcon = formatIcon;

  private readonly engagementService = inject(EngagementService);

  protected readonly finishedEngagements = toSignal(
    this.engagementService.engagements('finished'),
    {
      initialValue: [],
    },
  );
}
