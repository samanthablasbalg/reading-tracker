import { TestBed } from '@angular/core/testing';
import { InsightsComponent } from './insights';

describe('InsightsComponent', () => {
  it('renders a coming-soon message', () => {
    TestBed.configureTestingModule({
      imports: [InsightsComponent],
    });

    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Coming soon');
  });
});
