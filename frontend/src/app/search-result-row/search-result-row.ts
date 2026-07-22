import { Component, computed, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { BookSearchResult } from '../book.service';

const STATUS_LABEL: Record<'reading' | 'finished' | 'dnf', string> = {
  reading: 'Reading',
  finished: 'Finished',
  dnf: 'DNF',
};

@Component({
  selector: 'app-search-result-row',
  imports: [NgOptimizedImage, MatButtonModule],
  templateUrl: './search-result-row.html',
})
export class SearchResultRowComponent {
  readonly result = input.required<BookSearchResult>();
  readonly importing = input(false);

  readonly importRequested = output<void>();
  readonly addRequested = output<void>();

  protected readonly stateLabel = computed<string | null>(() => {
    const result = this.result();
    switch (result.state) {
      case 'in_library':
        return result.status ? STATUS_LABEL[result.status] : null;
      case 'in_catalog':
        return 'In catalog';
      default:
        return null;
    }
  });
}
