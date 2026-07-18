import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../auth.service';

interface NavDestination {
  label: string;
  icon: string;
  route: string;
}

const DESTINATIONS: NavDestination[] = [
  { label: 'Home', icon: 'home', route: '/currently-reading' },
  { label: 'Library', icon: 'library', route: '/catalog' },
  { label: 'Insights', icon: 'insights', route: '/insights' },
  { label: 'Challenges', icon: 'challenges', route: '/challenges' },
];

const ICON_MARKUP = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:var(--icon-size, 24px);height:var(--icon-size, 24px);display:block"`;

const ICONS: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" ${ICON_MARKUP}><path d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>`,
  library: `<svg viewBox="0 0 24 24" ${ICON_MARKUP}><path d="M4 4h6v16H4z"/><path d="M10 4h6v16h-6z"/><path d="M16 4l4 .8-3 15.5-4-.8"/></svg>`,
  insights: `<svg viewBox="0 0 24 24" ${ICON_MARKUP}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>`,
  challenges: `<svg viewBox="0 0 24 24" ${ICON_MARKUP}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>`,
};

const TOUCH_HANDSET =
  '(max-width: 599.98px), ' +
  '(min-width: 600px) and (max-width: 959.98px) and (orientation: landscape) and (pointer: coarse)';

@Component({
  selector: 'app-nav-shell',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatMenuModule],
  styles: [
    `
      .shell {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--color-background);
        color: var(--color-text);
      }

      .topbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 16px;
      }

      .avatar-button {
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: 50%;
      }

      .avatar-img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }

      .avatar-fallback {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(140deg, var(--color-secondary), var(--color-primary));
        color: #fff;
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 15px;
      }

      .menu-header {
        padding: 8px 16px;
        font-size: 0.875rem;
        font-family: var(--font-sans);
        color: var(--color-muted);
        border-bottom: 1px solid var(--color-border);
      }

      .body {
        flex: 1;
        display: flex;
      }

      .content {
        flex: 1;
        min-width: 0;
      }

      .content.with-bottom-bar {
        padding-bottom: 64px;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 236px;
        flex-shrink: 0;
        padding: 20px 14px;
        border-right: 1px solid var(--color-border);
      }

      .sidebar .nav-item {
        border-radius: 11px;
        padding: 10px 12px;
        font-size: 14px;
      }

      .sidebar .nav-icon {
        --icon-size: 20px;
      }

      .sidebar .nav-item:hover {
        opacity: 0.85;
        background: rgba(128, 128, 128, 0.08);
      }

      .sidebar .nav-item.active {
        background: color-mix(in srgb, var(--color-primary) 14%, transparent);
      }

      .bottom-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        padding: 10px 8px 22px;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
      }

      .bottom-bar .nav-item {
        flex: 1;
        flex-direction: column;
        gap: 4px;
        padding: 0;
        font-size: 10.5px;
      }

      .bottom-bar .nav-icon {
        --icon-size: 23px;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        font-family: var(--font-sans);
        font-weight: 600;
        color: var(--color-text);
        opacity: 0.6;
      }

      .nav-item.active {
        opacity: 1;
        color: var(--color-primary);
      }
    `,
  ],
  template: `
    <div class="shell">
      <header class="topbar">
        <button
          mat-icon-button
          class="avatar-button"
          [matMenuTriggerFor]="accountMenu"
          aria-label="Account menu"
        >
          @if (picture(); as src) {
            <img [src]="src" alt="" class="avatar-img" referrerpolicy="no-referrer" />
          } @else {
            <span class="avatar-fallback">{{ initial() }}</span>
          }
        </button>
        <mat-menu #accountMenu="matMenu">
          <div class="menu-header">{{ email() }}</div>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Log out</span>
          </button>
        </mat-menu>
      </header>

      <div class="body">
        @if (!isMobile()) {
          <nav class="sidebar" aria-label="Primary">
            @for (destination of destinations; track destination.route) {
              <a [routerLink]="destination.route" routerLinkActive="active" class="nav-item">
                <span class="nav-icon" [innerHTML]="iconSvg(destination.icon)"></span>
                <span class="nav-label">{{ destination.label }}</span>
              </a>
            }
          </nav>
        }

        <main class="content" [class.with-bottom-bar]="isMobile()">
          <ng-content />
        </main>
      </div>

      @if (isMobile()) {
        <nav class="bottom-bar" aria-label="Primary">
          @for (destination of destinations; track destination.route) {
            <a [routerLink]="destination.route" routerLinkActive="active" class="nav-item">
              <span class="nav-icon" [innerHTML]="iconSvg(destination.icon)"></span>
              <span class="nav-label">{{ destination.label }}</span>
            </a>
          }
        </nav>
      }
    </div>
  `,
})
export class NavShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly destinations = DESTINATIONS;

  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe(TOUCH_HANDSET).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected readonly email = computed(() => this.auth.currentUser()?.email);
  protected readonly picture = computed(() => this.auth.currentUser()?.picture);
  protected readonly initial = computed(() => this.email()?.charAt(0).toUpperCase() ?? '?');

  protected iconSvg(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[name]);
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/']));
  }
}
