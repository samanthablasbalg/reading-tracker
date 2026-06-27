import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InlineDateEditComponent } from './inline-date-edit';

@Component({
  template: `
    <app-inline-date-edit
      [value]="value"
      label="test date"
      [(editing)]="editing"
      [error]="error()"
      (saved)="onSaved($event)"
    />
  `,
  imports: [InlineDateEditComponent],
})
class HostComponent {
  value: string | null = '2026-01-01';
  editing = signal(false);
  error = signal<string | null>(null);
  savedValue: string | null = null;
  onSaved(val: string): void {
    this.savedValue = val;
  }
}

describe('InlineDateEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  it('renders a display button with the formatted date', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button[aria-label="Edit test date"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Jan');
  });

  it('renders a dash when value is null', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value = null;
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button[aria-label="Edit test date"]');
    expect(btn.textContent.trim()).toBe('—');
  });

  it('clicking the display button enters edit mode', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[aria-label="Edit test date"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeTruthy();
  });

  it('clicking the save button emits the new value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    input.value = '2026-03-01';
    fixture.nativeElement.querySelector('button[aria-label="Save test date"]').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.savedValue).toBe('2026-03-01');
  });

  it('pressing Enter emits the new value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    input.value = '2026-04-01';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.savedValue).toBe('2026-04-01');
  });

  it('pressing Escape cancels without emitting', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('input[type="date"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();
    expect(fixture.componentInstance.savedValue).toBeNull();
  });

  it('clicking the cancel button cancels without emitting', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[aria-label="Cancel test date edit"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();
    expect(fixture.componentInstance.savedValue).toBeNull();
  });

  it('shows error message when error is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.editing.set(true);
    fixture.componentInstance.error.set('Date is invalid');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
      'Date is invalid',
    );
  });
});
