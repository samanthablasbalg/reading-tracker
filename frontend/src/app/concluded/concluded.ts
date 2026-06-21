import { Component } from '@angular/core';
import { DNFComponent } from '../dnf/dnf';
import { ReadComponent } from '../read/read';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-concluded',
  imports: [ReadComponent, DNFComponent, MatDividerModule],
  template: `<h2 mat-dialog-title>Finished Books</h2>
    <app-read />
    <mat-divider></mat-divider>
    <h2 mat-dialog-title>DNFed Books</h2>
    <app-dnf />`,
})
export class ConcludedComponent {}
