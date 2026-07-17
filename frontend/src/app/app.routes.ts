import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'currently-reading', pathMatch: 'full' },
      {
        path: 'currently-reading',
        loadComponent: () =>
          import('./currently-reading/currently-reading').then((m) => m.CurrentlyReadingComponent),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./catalog/catalog').then((m) => m.CatalogComponent),
      },
      {
        path: 'concluded',
        loadComponent: () => import('./concluded/concluded').then((m) => m.ConcludedComponent),
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
