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
    path: 'read',
    loadComponent: () => import('./read/read').then((m) => m.ReadComponent),
  },
];
