import { Component, input } from '@angular/core';

/**
 * The Google "G" mark used on every Google-auth button. `variant="onDark"`
 * adds the white circular backdrop needed when the button itself is a
 * solid brand-color pill (hero + final CTA); the default renders the mark
 * directly for buttons with a light/white background (nav).
 */
@Component({
  selector: 'app-google-icon',
  template: `
    @if (variant() === 'onDark') {
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect width="18" height="18" rx="9" fill="#FFFFFF" />
        <g transform="scale(0.72) translate(3.5,3.5)">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.94v2.34C2.42 15.98 5.48 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.7V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.04l3.03-2.34z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.48 0 2.42 2.02.94 4.96l3.03 2.34C4.68 5.16 6.66 3.58 9 3.58z"
          />
        </g>
      </svg>
    } @else {
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.94v2.34C2.42 15.98 5.48 18 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.7V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.04l3.03-2.34z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.48 0 2.42 2.02.94 4.96l3.03 2.34C4.68 5.16 6.66 3.58 9 3.58z"
        />
      </svg>
    }
  `,
})
export class GoogleIconComponent {
  readonly variant = input<'default' | 'onDark'>('default');
}
