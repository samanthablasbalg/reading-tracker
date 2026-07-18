import { Component, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { GoogleIconComponent } from '../google-icon/google-icon';
import { HeroComponent } from './hero/hero';
import { DifferentiatorsComponent } from './differentiators/differentiators';
import { FeaturesComponent } from './features/features';
import { InsightsBandComponent } from './insights-band/insights-band';

@Component({
  selector: 'app-landing',
  imports: [
    GoogleIconComponent,
    HeroComponent,
    DifferentiatorsComponent,
    FeaturesComponent,
    InsightsBandComponent,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();
}
