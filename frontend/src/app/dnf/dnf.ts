import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { EngagementService } from '../engagement.service';

@Component({
  selector: 'app-dnf',
  imports: [MatListModule, DatePipe],
  template: `
    <mat-list>
      @for (engagement of dnfEngagements(); track engagement.id) {
        <mat-list-item>
          <span matListItemTitle>{{ engagement.book.title }}</span>
          <span matListItemLine>
            {{ engagement.book.authors.map((a) => a.name).join(', ') }}
          </span>
          <span matListItemLine>
            Gave up on {{ engagement.abandoned_on | date: 'mediumDate' : 'UTC' }}</span
          >
        </mat-list-item>
      } @empty {
        <p>No DNFed books yet.</p>
      }
    </mat-list>
  `,
})
export class DNFComponent {
  private readonly engagementService = inject(EngagementService);

  protected readonly dnfEngagements = toSignal(this.engagementService.engagements('dnf'), {
    initialValue: [],
  });
}
