import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavShellComponent } from '../nav-shell/nav-shell';

@Component({
  selector: 'app-authenticated-shell',
  imports: [RouterOutlet, NavShellComponent],
  template: `
    <app-nav-shell>
      <router-outlet />
    </app-nav-shell>
  `,
})
export class AuthenticatedShellComponent {}
