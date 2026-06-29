import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { PartsService } from '../../services/parts.service';
import { NotificationService } from '../../services/notification.service';
import { Part, PartSearchResult } from '../../models/part.model';
import { Vehicle } from '../../models/vehicle.model';

@Component({
  selector: 'app-parts-locator',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatCardModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatChipsModule, MatSnackBarModule,
    MatRadioModule, MatTooltipModule,
  ],
  templateUrl: './parts-locator.component.html',
  styleUrl: './parts-locator.component.scss',
})
export class PartsLocatorComponent implements OnChanges {
  @Input() partNames: string[] = [];
  @Input() vehicle: Vehicle = { year: null, make: null, model: null, subModel: null, mileage: null, vin: null };

  zipCode = '';
  locating = signal(false);
  searching = signal(false);
  results = signal<PartSearchResult[]>([]);
  locationError = signal<string | null>(null);

  notifyMethod: 'sms' | 'email' = 'sms';
  notifyRecipient = '';
  sendingNotification = signal(false);
  isMobile = signal(false);

  constructor(
    private partsService: PartsService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar,
  ) {
    this.isMobile.set('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['partNames'] && this.partNames.length > 0 && this.zipCode) {
      this.searchParts();
    }
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set('Geolocation is not supported by your browser.');
      return;
    }
    this.locating.set(true);
    this.locationError.set(null);
    navigator.geolocation.getCurrentPosition(
      async position => {
        // Reverse geocode to get ZIP via a simple fetch
        // TODO: replace with a real reverse geocoding API
        this.locating.set(false);
        this.locationError.set(null);
        this.snackBar.open('Location obtained — please enter your ZIP code to search nearby stores.', 'OK', { duration: 4000 });
      },
      () => {
        this.locating.set(false);
        this.locationError.set('Location access denied. Please enter your ZIP code manually.');
      }
    );
  }

  searchParts(): void {
    if (!this.zipCode || this.partNames.length === 0) return;
    this.searching.set(true);
    this.results.set([]);

    const requests = this.partNames.map(p =>
      this.partsService.searchParts(p, this.vehicle, this.zipCode)
    );

    forkJoin(requests).subscribe({
      next: resultArrays => {
        const all: PartSearchResult[] = resultArrays.flat().map(part => ({ part, selected: false }));
        this.results.set(all);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  toggleSelection(item: PartSearchResult): void {
    this.results.update(list =>
      list.map(i => i === item ? { ...i, selected: !i.selected } : i)
    );
  }

  get selectedCount(): number {
    return this.results().filter(i => i.selected).length;
  }

  get selectedTotal(): number {
    return this.results().filter(i => i.selected).reduce((s, i) => s + i.part.price, 0);
  }

  async sendList(): Promise<void> {
    const selected = this.results().filter(i => i.selected);
    if (!selected.length) return;

    const listText = this.notificationService.buildShoppingList(this.results());

    if (this.notifyMethod === 'sms' && this.isMobile()) {
      this.notificationService.openSmsLink(this.notifyRecipient || '', listText);
      return;
    }

    this.sendingNotification.set(true);
    this.notificationService
      .send({ recipient: this.notifyRecipient, type: this.notifyMethod, items: this.results() })
      .subscribe({
        next: () => {
          this.sendingNotification.set(false);
          this.snackBar.open('Parts list sent!', 'Done', { duration: 3000 });
        },
        error: () => {
          this.sendingNotification.set(false);
          this.snackBar.open('Could not send — check server connection.', 'Dismiss', { duration: 4000 });
        },
      });
  }

  async copyList(): Promise<void> {
    const listText = this.notificationService.buildShoppingList(this.results());
    await this.notificationService.copyToClipboard(listText);
    this.snackBar.open('Parts list copied to clipboard!', 'Done', { duration: 2500 });
  }
}
