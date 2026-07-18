import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { NavShellComponent } from './nav-shell/nav-shell';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavShellComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
}
