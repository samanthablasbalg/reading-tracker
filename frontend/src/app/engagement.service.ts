import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Book } from './book.service';

export type EngagementStatus = 'reading' | 'finished';

export type EngagedBook = Pick<Book, 'id' | 'title' | 'authors' | 'default_page_count'>;

export interface Engagement {
  id: string;
  book: EngagedBook;
  formats: string[];
  cover_url: string | null;
  status: EngagementStatus;
  started_on: string | null;
  finished_on: string | null;
  resume_from_page: number;
  completion_pct: number | null;
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<EngagementStatus, BehaviorSubject<Engagement[]>>();

  private subject(status: EngagementStatus): BehaviorSubject<Engagement[]> {
    if (!this.cache.has(status)) {
      this.cache.set(status, new BehaviorSubject<Engagement[]>([]));
    }
    return this.cache.get(status)!;
  }

  private fetch(status: EngagementStatus): void {
    this.http
      .get<Engagement[]>('/api/engagements', { params: { status } })
      .subscribe((list) => this.subject(status).next(list));
  }

  engagements(status: EngagementStatus): Observable<Engagement[]> {
    const subject = this.subject(status);
    this.fetch(status);
    return subject.asObservable();
  }

  reloadEngagements(): void {
    this.cache.forEach((_, status) => this.fetch(status));
  }

  patchEngagementInPlace(id: string, patch: Partial<Engagement>): void {
    const subject = this.cache.get('reading');
    if (subject) {
      subject.next(subject.value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }
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
