import {
  Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';

@Component({
  selector: 'app-vehicle-selector',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatDividerModule,
  ],
  templateUrl: './vehicle-selector.component.html',
  styleUrl: './vehicle-selector.component.scss',
})
export class VehicleSelectorComponent implements OnInit, OnDestroy {
  @Output() vehicleChanged = new EventEmitter<Vehicle>();

  form: FormGroup;

  years: number[] = [];
  makes = signal<string[]>([]);
  models = signal<string[]>([]);

  loadingMakes = signal(false);
  loadingModels = signal(false);
  loadingVin = signal(false);
  scannerActive = signal(false);
  isMobile = signal(false);

  vinError = signal<string | null>(null);
  scanError = signal<string | null>(null);

  @ViewChild('videoPreview') private videoRef?: ElementRef<HTMLVideoElement>;
  private videoEl: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private vehicleService: VehicleService) {
    this.form = this.fb.group({
      year:     [null],
      make:     [{ value: null, disabled: true }],
      model:    [{ value: null, disabled: true }],
      subModel: [null],
      mileage:  [null],
      vin:      [null],
    });
  }

  ngOnInit(): void {
    this.years = this.vehicleService.getYears();
    this.isMobile.set('ontouchstart' in window || navigator.maxTouchPoints > 0);

    this.form.get('year')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(year => {
      this.form.get('make')!.reset(null);
      this.form.get('model')!.reset(null);
      this.makes.set([]);
      this.models.set([]);

      if (!year) return;

      this.loadingMakes.set(true);
      this.form.get('make')!.disable();
      this.vehicleService.getMakes(year).subscribe({
        next: makes => {
          this.makes.set(makes);
          this.form.get('make')!.enable();
          this.loadingMakes.set(false);
        },
        error: () => this.loadingMakes.set(false),
      });
    });

    this.form.get('make')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(make => {
      this.form.get('model')!.reset(null);
      this.models.set([]);

      const year = this.form.get('year')!.value;
      if (!make || !year) return;

      this.loadingModels.set(true);
      this.form.get('model')!.disable();
      this.vehicleService.getModels(year, make).subscribe({
        next: models => {
          this.models.set(models);
          this.form.get('model')!.enable();
          this.loadingModels.set(false);
        },
        error: () => this.loadingModels.set(false),
      });
    });

    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.vehicleChanged.emit(this.form.getRawValue() as Vehicle);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopScanner();
  }

  decodeVin(): void {
    const vin = (this.form.get('vin')!.value ?? '').trim().toUpperCase();
    if (!vin || vin.length !== 17) {
      this.vinError.set('VIN must be exactly 17 characters.');
      return;
    }
    this.vinError.set(null);
    this.loadingVin.set(true);

    this.vehicleService.decodeVin(vin).subscribe({
      next: result => {
        if (result.year) this.form.get('year')!.setValue(result.year);
        if (result.make) {
          setTimeout(() => {
            const normalizedMake = this.makes().find(
              m => m.toUpperCase() === (result.make ?? '').toUpperCase()
            ) ?? result.make;
            this.form.get('make')!.setValue(normalizedMake);
            if (result.model) {
              setTimeout(() => this.form.get('model')!.setValue(result.model), 600);
            }
            if (result.subModel) {
              setTimeout(() => this.form.get('subModel')!.setValue(result.subModel), 600);
            }
          }, 600);
        }
        this.loadingVin.set(false);
      },
      error: () => {
        this.vinError.set('Could not decode VIN. Please fill in vehicle details manually.');
        this.loadingVin.set(false);
      },
    });
  }

  async startScanner(): Promise<void> {
    this.scanError.set(null);
    this.scannerActive.set(true);
    // Wait one tick for *videoPreview to render before accessing it
    setTimeout(async () => {
      const videoEl = this.videoRef?.nativeElement;
      if (!videoEl) return;
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        videoEl.srcObject = this.stream;
        await videoEl.play();
        this.videoEl = videoEl;
        this.runBarcodeDetection(videoEl);
      } catch {
        this.scannerActive.set(false);
        this.scanError.set('Camera access denied. Please enter your VIN manually.');
      }
    }, 50);
  }

  stopScanner(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.videoEl = null;
    this.scannerActive.set(false);
  }

  private async runBarcodeDetection(video: HTMLVideoElement): Promise<void> {
    const BarcodeDetector = (window as any)['BarcodeDetector'];
    if (!BarcodeDetector) {
      this.scanError.set('Barcode scanning not supported on this device. Enter VIN manually.');
      this.stopScanner();
      return;
    }
    const detector = new BarcodeDetector({ formats: ['code_39', 'code_128', 'data_matrix'] });
    const scan = async () => {
      if (!this.scannerActive()) return;
      try {
        const barcodes = await detector.detect(video);
        for (const barcode of barcodes) {
          const val = barcode.rawValue?.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
          if (val && val.length === 17) {
            this.form.get('vin')!.setValue(val);
            this.stopScanner();
            this.decodeVin();
            return;
          }
        }
      } catch { /* continue scanning */ }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }
}
