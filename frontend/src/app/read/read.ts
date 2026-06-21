import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { EngagementService } from '../engagement.service';

@Component({
  selector: 'app-read',
  imports: [MatListModule, DatePipe],
  template: `
    <mat-list>
      @for (engagement of [...finishedEngagements(), ...dnfEngagements()]; track engagement.id) {
        <mat-list-item>
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
          </span>
          @if (engagement.finished_on) {
            <span matListItemLine>
              Finished {{ engagement.finished_on | date: 'mediumDate' : 'UTC' }}</span
            >
          }
          @if (engagement.abandoned_on) {
            <span matListItemLine>
              Gave up on {{ engagement.abandoned_on | date: 'mediumDate' : 'UTC' }}</span
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
  private readonly engagementService = inject(EngagementService);

  protected readonly finishedEngagements = toSignal(
    this.engagementService.engagements('finished'),
    {
      initialValue: [],
    },
  );
  protected readonly dnfEngagements = toSignal(this.engagementService.engagements('dnf'), {
    initialValue: [],
  });
}
