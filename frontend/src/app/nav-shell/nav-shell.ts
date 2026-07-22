import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../auth.service';
import { SearchPanelComponent } from '../search-panel/search-panel';

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
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    SearchPanelComponent,
  ],
  template: `
    <div class="bg-background text-text">
      <div class="flex flex-col min-h-dvh">
        <header class="flex justify-end items-center gap-1 px-4 py-2">
          @if (isMobile()) {
            <button
              mat-icon-button
              class="!w-10 !h-10 !p-0 !rounded-full"
              aria-label="Search books"
              (click)="openMobileSearch()"
            >
              <mat-icon>search</mat-icon>
            </button>
          } @else {
            <app-search-panel />
          }

          <button
            mat-icon-button
            class="!w-10 !h-10 !p-0 !rounded-full"
            [matMenuTriggerFor]="accountMenu"
            aria-label="Account menu"
          >
            @if (picture(); as src) {
              <img
                [src]="src"
                alt=""
                class="!w-10 !h-10 rounded-full object-cover"
                referrerpolicy="no-referrer"
              />
            } @else {
              <span
                class="flex items-center justify-center w-10 h-10 rounded-full bg-[linear-gradient(140deg,var(--color-secondary),var(--color-primary))] text-on-primary font-sans font-extrabold text-[15px]"
                >{{ initial() }}</span
              >
            }
          </button>
          <mat-menu #accountMenu="matMenu">
            <div class="px-4 py-2 text-sm font-sans text-muted border-b border-border">
              {{ email() }}
            </div>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Log out</span>
            </button>
          </mat-menu>
        </header>

        <div class="flex-1 flex">
          @if (!isMobile()) {
            <nav
              class="flex flex-col gap-[3px] w-[236px] shrink-0 px-3.5 py-5 border-r border-border"
              aria-label="Primary"
            >
              @for (destination of destinations; track destination.route) {
                <a
                  [routerLink]="destination.route"
                  routerLinkActive
                  #rla="routerLinkActive"
                  class="flex items-center gap-3 no-underline font-sans font-semibold text-sm rounded-[11px] px-3 py-2.5 hover:bg-hover [--icon-size:20px]"
                  [class]="
                    rla.isActive
                      ? 'text-primary bg-primary/14'
                      : 'text-muted-strong hover:text-text'
                  "
                >
                  <span [innerHTML]="iconSvg(destination.icon)"></span>
                  <span>{{ destination.label }}</span>
                </a>
              }
            </nav>
          }

          <main class="flex-1 min-w-0 isolate">
            <ng-content />
          </main>
        </div>
      </div>

      @if (isMobile()) {
        <nav
          class="sticky bottom-0 flex px-2 pt-2.5 pb-[calc(10px_+_env(safe-area-inset-bottom))] bg-surface border-t border-border"
          aria-label="Primary"
        >
          @for (destination of destinations; track destination.route) {
            <a
              [routerLink]="destination.route"
              routerLinkActive
              #rla="routerLinkActive"
              class="flex-1 flex flex-col items-center gap-1 no-underline text-label-sm [--icon-size:23px]"
              [class]="rla.isActive ? 'text-primary' : 'text-muted-strong'"
            >
              <span [innerHTML]="iconSvg(destination.icon)"></span>
              <span>{{ destination.label }}</span>
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
  private readonly dialog = inject(MatDialog);

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

  // Mobile gets a full-screen dialog (matches the mockup - search takes over the whole
  // screen). Desktop renders app-search-panel directly - it owns its own collapsed/expanded
  // bar and the results dropdown below it.
  protected openMobileSearch(): void {
    this.dialog.open(SearchPanelComponent, { panelClass: 'search-dialog-fullscreen' });
  }
}
