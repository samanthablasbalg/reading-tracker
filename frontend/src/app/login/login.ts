import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule],
  styles: `
    :host {
      display: flex;
      justify-content: center;
      padding-top: 96px;
    }
  `,
  template: ` <button mat-flat-button (click)="auth.login()">Log in with Google</button> `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
}
