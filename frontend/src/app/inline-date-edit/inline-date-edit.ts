import { Component, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-inline-date-edit',
  imports: [DatePipe, MatButtonModule, MatIconModule],
  styles: [
    `
      :host {
        display: inline;
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
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .field-error {
        display: block;
        font-size: 0.75rem;
        color: var(--mat-sys-error);
        margin-top: 2px;
      }
    `,
  ],
  template: `
    @if (editing()) {
      <div class="edit-row">
        <input
          #inp
          type="date"
          [value]="value() ?? ''"
          [attr.aria-label]="label()"
          (keydown.enter)="save(inp.value)"
          (keydown.escape)="cancel()"
        />
        <button
          type="button"
          mat-icon-button
          [attr.aria-label]="'Save ' + label()"
          (click)="save(inp.value)"
        >
          <mat-icon>check</mat-icon>
        </button>
        <button
          type="button"
          mat-icon-button
          [attr.aria-label]="'Cancel ' + label() + ' edit'"
          (click)="cancel()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
      @if (error()) {
        <span class="field-error" role="alert">{{ error() }}</span>
      }
    } @else {
      <button
        type="button"
        class="editable-btn"
        [attr.aria-label]="'Edit ' + label()"
        (click)="editing.set(true)"
      >
        {{ value() ? (value()! | date: 'mediumDate' : 'UTC') : '—' }}
      </button>
    }
  `,
})
export class InlineDateEditComponent {
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  readonly error = input<string | null>(null);
  readonly editing = model(false);
  readonly saved = output<string>();

  protected save(val: string): void {
    if (!val) {
      this.editing.set(false);
      return;
    }
    this.saved.emit(val);
  }

  protected cancel(): void {
    this.editing.set(false);
  }
}
