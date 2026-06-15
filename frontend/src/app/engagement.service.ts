import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, shareReplay, startWith, switchMap } from 'rxjs';
import { Book } from './book.service';

export type EngagementStatus = 'reading' | 'finished';

export type EngagedBook = Pick<Book, 'id' | 'title' | 'authors'>;

export interface Engagement {
  id: string;
  book: EngagedBook;
  status: EngagementStatus;
  started_on: string | null;
  finished_on: string | null;
  resume_from_page: number;
  completion_pct: number | null;
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly http = inject(HttpClient);
  private readonly reloadTrigger = new Subject<void>();

  engagements(status: EngagementStatus): Observable<Engagement[]> {
    return this.reloadTrigger.pipe(
      startWith(undefined),
      switchMap(() => this.http.get<Engagement[]>('/api/engagements', { params: { status } })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  reloadEngagements(): void {
    this.reloadTrigger.next();
  }

  markReading(bookId: string): Observable<Engagement> {
    return this.http.post<Engagement>('/api/engagements', { book_id: bookId });
  }

  markFinished(engagementId: string): Observable<Engagement> {
    return this.http.patch<Engagement>(`/api/engagements/${engagementId}`, { status: 'finished' });
  }

  logProgress(engagementId: string, currentPage: number): Observable<unknown> {
    return this.http.post<unknown>(`/api/engagements/${engagementId}/progress-logs`, {
      current_page: currentPage,
    });
  }
}
