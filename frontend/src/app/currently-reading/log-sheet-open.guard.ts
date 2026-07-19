import { CanDeactivateFn } from '@angular/router';
import { CurrentlyReadingComponent } from './currently-reading';

/** Blocks navigating away from Currently Reading while the mobile log sheet is open —
 *  including the browser back button — closing the sheet instead. Router consults
 *  `canDeactivate` guards for popstate-triggered navigations too, so this is enough on
 *  its own; no manual history/popstate handling is needed. */
export const logSheetOpenGuard: CanDeactivateFn<CurrentlyReadingComponent> = (component) => {
  if (component.logSheetOpen()) {
    component.closeLogSheet();
    return false;
  }
  return true;
};
