import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, shareReplay, startWith, switchMap } from 'rxjs';
import { Author } from './book.service';

export interface EngagedBook {
  id: string;
  title: string;
  authors: Author[];
}

export interface Engagement {
  id: string;
  book: EngagedBook;
  status: 'reading' | 'finished';
  started_on: string | null;
  finished_on: string | null;
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly http = inject(HttpClient);
  private readonly reloadTrigger = new Subject<void>();

  readonly readingEngagements$: Observable<Engagement[]> = this.reloadTrigger.pipe(
    startWith(undefined),
    switchMap(() =>
      this.http.get<Engagement[]>('/api/engagements', { params: { status: 'reading' } }),
    ),
    shareReplay(1),
  );

  readonly finishedEngagements$: Observable<Engagement[]> = this.reloadTrigger.pipe(
    startWith(undefined),
    switchMap(() =>
      this.http.get<Engagement[]>('/api/engagements', { params: { status: 'finished' } }),
    ),
    shareReplay(1),
  );

  reloadEngagements(): void {
    this.reloadTrigger.next();
  }

  markReading(bookId: string): Observable<Engagement> {
    return this.http.post<Engagement>('/api/engagements', { book_id: bookId });
  }

  markFinished(engagementId: string): Observable<Engagement> {
    return this.http.patch<Engagement>(`/api/engagements/${engagementId}`, { status: 'finished' });
  }
}
