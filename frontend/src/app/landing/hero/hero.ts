import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../auth.service';
import { GoogleIconComponent } from '../../google-icon/google-icon';

@Component({
  selector: 'app-hero',
  imports: [NgOptimizedImage, GoogleIconComponent],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class HeroComponent {
  protected readonly auth = inject(AuthService);
}
