import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth.service';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  it('calls AuthService.login when the button is clicked', () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const auth = TestBed.inject(AuthService);
    const loginSpy = vi.spyOn(auth, 'login').mockImplementation(() => undefined);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();

    expect(loginSpy).toHaveBeenCalled();
  });
});
