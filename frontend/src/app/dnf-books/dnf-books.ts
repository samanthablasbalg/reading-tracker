import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DNFComponent } from '../dnf/dnf';

@Component({
  selector: 'app-dnf-books',
  imports: [MatButtonModule, MatIconModule, DNFComponent],
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 16px 0;
      }

      .title {
        font-family: var(--font-serif);
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text);
      }
    `,
  ],
  template: `
    <div class="header">
      <button mat-icon-button (click)="back()" aria-label="Go back">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span class="title">Did not finish</span>
    </div>
    <app-dnf />
  `,
})
export class DnfBooksComponent {
  private readonly location = inject(Location);

  protected back(): void {
    this.location.back();
  }
}
