import { Component } from '@angular/core';
import { DNFComponent } from '../dnf/dnf';
import { ReadComponent } from '../read/read';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-concluded',
  imports: [ReadComponent, DNFComponent, MatDividerModule],
  template: `<app-read />
    <mat-divider></mat-divider>
    <app-dnf />`,
})
export class ConcludedComponent {}
