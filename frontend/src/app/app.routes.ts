import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';
import { logSheetOpenGuard } from './currently-reading/log-sheet-open.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () => import('./landing/landing').then((m) => m.LandingComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./authenticated-shell/authenticated-shell').then(
        (m) => m.AuthenticatedShellComponent,
      ),
    children: [
      {
        path: 'currently-reading',
        canDeactivate: [logSheetOpenGuard],
        loadComponent: () =>
          import('./currently-reading/currently-reading').then((m) => m.CurrentlyReadingComponent),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./catalog/catalog').then((m) => m.CatalogComponent),
      },
      {
        path: 'finished',
        loadComponent: () =>
          import('./finished-books/finished-books').then((m) => m.FinishedBooksComponent),
      },
      {
        path: 'dnf',
        loadComponent: () => import('./dnf-books/dnf-books').then((m) => m.DnfBooksComponent),
      },
      {
        path: 'insights',
        loadComponent: () => import('./insights/insights').then((m) => m.InsightsComponent),
      },
      {
        path: 'challenges',
        loadComponent: () => import('./challenges/challenges').then((m) => m.ChallengesComponent),
      },
      {
        path: 'engagement/:id',
        loadComponent: () =>
          import('./engagement-history/engagement-history').then(
            (m) => m.EngagementHistoryComponent,
          ),
      },
    ],
  },
];
