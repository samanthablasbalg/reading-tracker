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
      @for (engagement of engagements(); track engagement.id) {
        <mat-list-item>
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
          </span>
          <span matListItemLine
            >Finished {{ engagement.finished_on | date: 'mediumDate' : 'UTC' }}</span
          >
        </mat-list-item>
      } @empty {
        <p>No finished books yet.</p>
      }
    </mat-list>
  `,
})
export class ReadComponent {
  private readonly engagementService = inject(EngagementService);

  protected readonly engagements = toSignal(this.engagementService.engagements('finished'), {
    initialValue: [],
  });
}
