import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../auth.service';
import { GoogleIconComponent } from '../google-icon/google-icon';

interface FeatureCard {
  title: string;
  body: string;
  tint: string;
  color: string;
  shape: string;
}

@Component({
  selector: 'app-landing',
  imports: [NgOptimizedImage, GoogleIconComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();

  protected readonly features: FeatureCard[] = [
    {
      title: 'Currently reading',
      body: 'Live today: add books to your library, three formats, one place to log progress.',
      tint: 'var(--color-tint-1)',
      color: 'var(--color-primary)',
      shape: '6px',
    },
    {
      title: 'Streaks',
      body: 'In progress: daily reading streaks with your longest-ever record on hand.',
      tint: 'var(--color-tint-4)',
      color: 'var(--color-secondary)',
      shape: '50%',
    },
    {
      title: 'Insights',
      body: 'Designed, building next: genres, formats, and pages read per month, charted.',
      tint: 'var(--color-tint-2)',
      color: 'var(--color-chart-3)',
      shape: '4px',
    },
    {
      title: 'Challenges',
      body: 'On the roadmap: set yearly goals and build personalized lists, watch them fill in as you read.',
      tint: 'var(--color-tint-3)',
      color: 'var(--color-chart-4)',
      shape: '50% 50% 50% 0',
    },
  ];
}
