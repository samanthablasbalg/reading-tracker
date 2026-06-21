import { Routes } from '@angular/router';

export const routes: Routes = [
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
];
