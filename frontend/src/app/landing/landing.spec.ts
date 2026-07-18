import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth.service';
import { LandingComponent } from './landing';

describe('LandingComponent', () => {
  function setUp() {
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const auth = TestBed.inject(AuthService);
    const loginSpy = vi.spyOn(auth, 'login').mockImplementation(() => undefined);

    return { fixture, loginSpy };
  }

  it('calls AuthService.login when the nav login button is clicked', () => {
    const { fixture, loginSpy } = setUp();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.landing-nav__login-btn');
    button.click();

    expect(loginSpy).toHaveBeenCalled();
  });

  it('calls AuthService.login when the hero CTA is clicked', () => {
    const { fixture, loginSpy } = setUp();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.hero__cta');
    button.click();

    expect(loginSpy).toHaveBeenCalled();
  });

  it('calls AuthService.login when the final CTA is clicked', () => {
    const { fixture, loginSpy } = setUp();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.final-cta__btn');
    button.click();

    expect(loginSpy).toHaveBeenCalled();
  });

  it('shows the current year in the footer', () => {
    const { fixture } = setUp();

    const meta: HTMLElement = fixture.nativeElement.querySelector('.landing-footer__meta');

    expect(meta.textContent).toContain(String(new Date().getFullYear()));
  });
});
