import { TestBed } from '@angular/core/testing';
import { ChallengesComponent } from './challenges';

describe('ChallengesComponent', () => {
  it('renders a coming-soon message', () => {
    TestBed.configureTestingModule({
      imports: [ChallengesComponent],
    });

    const fixture = TestBed.createComponent(ChallengesComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Coming soon');
  });
});
