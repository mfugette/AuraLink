import {
  Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { VehicleService, VehicleTrim } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';
import { IconComponent } from '../shared/icon/icon.component';

@Component({
  selector: 'app-vehicle-selector',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IconComponent, MatProgressSpinnerModule,
    MatTooltipModule, CustomSelectComponent,
  ],
  templateUrl: './vehicle-selector.component.html',
  styleUrl: './vehicle-selector.component.scss',
})
export class VehicleSelectorComponent implements OnInit, OnDestroy {
  @Output() vehicleChanged = new EventEmitter<Vehicle>();

  // When provided (edit mode), pre-fills the form and drives the
  // year→make→model→trim cascade so the existing vehicle is fully selected.
  @Input() initialVehicle: Vehicle | null = null;

  form: FormGroup;

  years: number[] = [];
  makes = signal<string[]>([]);
  models = signal<string[]>([]);

  readonly yearOptions = computed<SelectOption[]>(() =>
    this.years.map(y => ({ value: y, label: `${y}` }))
  );
  readonly makeOptions = computed<SelectOption[]>(() =>
    this.makes().map(m => ({ value: m, label: m }))
  );
  readonly modelOptions = computed<SelectOption[]>(() =>
    this.models().map(m => ({ value: m, label: m }))
  );
  readonly trimOptions = computed<SelectOption[]>(() =>
    this.trims().map((t, i) => ({ value: i, label: t.label }))
  );

  // Trim/engine options fetched via CarAPI once a valid model is selected.
  // Empty array means "not covered" — caller falls back to free-text entry.
  trims = signal<VehicleTrim[]>([]);
  selectedTrimIndex = signal<number | null>(null);

  loadingMakes = signal(false);
  loadingModels = signal(false);
  loadingTrims = signal(false);
  loadingVin = signal(false);
  scannerActive = signal(false);
  isMobile = signal(false);

  modelSelected = signal(false);
  vinFilledDetails = signal(false);
  detailsExpanded = signal(false);

  vinError = signal<string | null>(null);
  scanError = signal<string | null>(null);

  @ViewChild('videoPreview') private videoRef?: ElementRef<HTMLVideoElement>;
  private videoEl: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private zxingControls: IScannerControls | null = null;
  private destroy$ = new Subject<void>();

  private static toOptions(values: string[]): SelectOption[] {
    return values.map(v => ({ value: v, label: v }));
  }

  readonly driveTypeOptions = VehicleSelectorComponent.toOptions(['FWD', 'RWD', 'AWD', '4WD']);
  readonly transmissionOptions = VehicleSelectorComponent.toOptions(['Automatic', 'Manual', 'CVT', 'DCT']);
  readonly fuelTypeOptions = VehicleSelectorComponent.toOptions(['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric', 'Flex Fuel']);
  readonly bodyStyleOptions = VehicleSelectorComponent.toOptions(['Sedan', 'Coupe', 'Hatchback', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Wagon', 'Convertible']);

  constructor(private fb: FormBuilder, private vehicleService: VehicleService) {
    this.form = this.fb.group({
      year:         [null, Validators.required],
      make:         [{ value: null, disabled: true }, Validators.required],
      model:        [{ value: null, disabled: true }, Validators.required],
      subModel:     [{ value: null, disabled: true }],
      engine:       [{ value: null, disabled: true }],
      driveType:    [{ value: null, disabled: true }],
      transmission: [{ value: null, disabled: true }],
      fuelType:     [{ value: null, disabled: true }],
      bodyStyle:    [{ value: null, disabled: true }],
      mileage:      [{ value: null, disabled: true }],
      vin:          [null],
    });
  }

  // Fields that describe the specific vehicle instance — meaningless (and
  // disabled) until a model has actually been selected.
  private readonly detailFieldNames = [
    'subModel', 'engine', 'driveType', 'transmission', 'fuelType', 'bodyStyle', 'mileage',
  ] as const;

  private enableVehicleDetails(): void {
    for (const name of this.detailFieldNames) this.form.get(name)!.enable({ emitEvent: false });
  }

  ngOnInit(): void {
    this.years = this.vehicleService.getYears();
    this.isMobile.set('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // These three handlers only react to genuine user-driven changes (autocomplete
    // selection, or typed text that exactly matches a known option). Programmatic
    // cascade steps below use { emitEvent: false } so they don't re-trigger these
    // and wrongly wipe out data that's still valid for the new selection.

    this.form.get('year')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((year: number | null) => {
      const prevMake = this.form.get('make')!.value as string | null;
      const prevModel = this.form.get('model')!.value as string | null;

      this.makes.set([]);
      this.models.set([]);

      if (year == null || !this.years.includes(year)) {
        this.form.get('make')!.reset(null, { emitEvent: false });
        this.form.get('model')!.reset(null, { emitEvent: false });
        this.form.get('make')!.disable();
        this.form.get('model')!.disable();
        this.modelSelected.set(false);
        this.clearVehicleDetails();
        return;
      }

      this.loadingMakes.set(true);
      this.form.get('make')!.disable();
      this.vehicleService.getMakes(year).subscribe({
        next: makes => {
          this.makes.set(makes);
          this.form.get('make')!.enable();
          this.loadingMakes.set(false);

          // Keep the current make/model selected if they still exist for the new
          // year — only clear the parts of the vehicle that are no longer valid.
          if (prevMake && makes.includes(prevMake)) {
            this.form.get('make')!.setValue(prevMake, { emitEvent: false });
            this.preserveModelForYearChange(year, prevMake, prevModel);
          } else {
            this.form.get('model')!.reset(null, { emitEvent: false });
            this.form.get('model')!.disable();
            this.modelSelected.set(false);
            this.clearVehicleDetails();
          }
        },
        error: () => this.loadingMakes.set(false),
      });
    });

    this.form.get('make')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(make => {
      this.models.set([]);
      this.form.get('model')!.reset(null, { emitEvent: false });
      this.form.get('model')!.disable();
      this.modelSelected.set(false);
      this.clearVehicleDetails();

      const year = this.form.get('year')!.value;
      if (!make || !year) return;

      this.fetchModels(year, make);
    });

    this.form.get('model')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(model => {
      this.modelSelected.set(!!model);
      this.clearVehicleDetails();
      if (!model) return;
      this.enableVehicleDetails();

      const year = this.form.get('year')!.value;
      const make = this.form.get('make')!.value;
      // Only look up trims once the model exactly matches a fetched option —
      // ignores partial text fired by valueChanges while autocomplete-typing.
      if (!year || !make || !this.models().includes(model)) return;

      this.fetchTrims(year, make, model);
    });

    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.vehicleChanged.emit(this.form.getRawValue() as Vehicle);
    });

    // Edit mode: seed the form from the supplied vehicle after the base setup.
    if (this.initialVehicle) {
      this.seedFromVehicle(this.initialVehicle);
    }
  }

  /** Current form value (raw, so disabled controls are included). */
  get value(): Vehicle {
    return this.form.getRawValue() as Vehicle;
  }

  // Pre-fill for editing: apply detail fields immediately, then run the
  // year→make→model→trim cascade with the same timed, emitEvent:false pattern
  // used by decodeVin so the dependent autocompletes populate and stay selected.
  private seedFromVehicle(v: Vehicle): void {
    // Instance-detail fields don't depend on the cascade — set them up front.
    if (v.vin)          this.form.get('vin')!.setValue(v.vin, { emitEvent: false });
    if (v.driveType)    this.form.get('driveType')!.setValue(v.driveType);
    if (v.transmission) this.form.get('transmission')!.setValue(v.transmission);
    if (v.fuelType)     this.form.get('fuelType')!.setValue(v.fuelType);
    if (v.bodyStyle)    this.form.get('bodyStyle')!.setValue(v.bodyStyle);
    if (v.mileage != null) this.form.get('mileage')!.setValue(v.mileage);

    const hasDetails = !!(v.driveType || v.transmission || v.fuelType || v.bodyStyle || v.subModel || v.engine);

    if (v.year == null) return;
    this.form.get('year')!.setValue(v.year, { emitEvent: false });
    this.fetchMakes(v.year);

    if (!v.make) return;
    const year = v.year;
    setTimeout(() => {
      const normalizedMake = this.makes().find(
        m => m.toUpperCase() === (v.make ?? '').toUpperCase()
      ) ?? v.make!;
      this.form.get('make')!.setValue(normalizedMake, { emitEvent: false });
      this.fetchModels(year, normalizedMake);

      if (v.model) {
        setTimeout(() => {
          this.form.get('model')!.setValue(v.model, { emitEvent: false });
          this.modelSelected.set(true);
          this.enableVehicleDetails();
          if (v.engine)   this.form.get('engine')!.setValue(v.engine);
          if (v.subModel) this.form.get('subModel')!.setValue(v.subModel);
          if (hasDetails) { this.vinFilledDetails.set(true); this.detailsExpanded.set(true); }
          this.fetchTrims(year, normalizedMake, v.model!);
        }, 600);
      }
    }, 600);
  }

  // Continues the year-change cascade: refetches models for (year, make) and keeps
  // the previously-selected model (and everything under it) if it's still valid.
  private preserveModelForYearChange(year: number, make: string, prevModel: string | null): void {
    this.loadingModels.set(true);
    this.form.get('model')!.disable();
    this.vehicleService.getModels(year, make).subscribe({
      next: models => {
        this.models.set(models);
        this.form.get('model')!.enable();
        this.loadingModels.set(false);

        if (prevModel && models.includes(prevModel)) {
          this.form.get('model')!.setValue(prevModel, { emitEvent: false });
          this.modelSelected.set(true);
          this.enableVehicleDetails();
          this.fetchTrims(year, make, prevModel);
        } else {
          this.form.get('model')!.reset(null, { emitEvent: false });
          this.modelSelected.set(false);
          this.clearVehicleDetails();
        }
      },
      error: () => this.loadingModels.set(false),
    });
  }

  private fetchMakes(year: number): void {
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
  }

  private fetchModels(year: number, make: string): void {
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
  }

  private fetchTrims(year: number, make: string, model: string): void {
    this.loadingTrims.set(true);
    this.vehicleService.getTrims(year, make, model).subscribe({
      next: trims => {
        this.trims.set(trims);
        this.loadingTrims.set(false);
      },
      error: () => this.loadingTrims.set(false),
    });
  }

  // Clears every field describing the specific vehicle instance (as opposed to
  // its identity — year/make/model) since they're presumed stale once the
  // identity changes. Deliberately leaves year/make/model/vin untouched.
  private clearVehicleDetails(): void {
    this.form.patchValue({
      subModel: null,
      engine: null,
      driveType: null,
      transmission: null,
      fuelType: null,
      bodyStyle: null,
      mileage: null,
    });
    for (const name of this.detailFieldNames) this.form.get(name)!.disable({ emitEvent: false });
    this.trims.set([]);
    this.selectedTrimIndex.set(null);
    this.vinFilledDetails.set(false);
    this.detailsExpanded.set(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopScanner();
  }

  toggleDetails(): void {
    this.detailsExpanded.update(v => !v);
  }

  onTrimChange(index: unknown): void {
    if (index == null) return;
    this.onTrimSelected(index as number);
  }

  onTrimSelected(index: number): void {
    const trim = this.trims()[index];
    if (!trim) return;
    this.selectedTrimIndex.set(index);
    this.form.get('subModel')!.setValue(trim.subModel);
    if (trim.engine) this.form.get('engine')!.setValue(trim.engine);
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
        // A new VIN describes a different vehicle — wipe whatever was previously
        // entered before applying this decode's values. Cascade steps below use
        // { emitEvent: false } throughout so they drive fetches directly instead
        // of going through the user-driven change handlers in ngOnInit.
        this.form.get('year')!.reset(null, { emitEvent: false });
        this.form.get('make')!.reset(null, { emitEvent: false });
        this.form.get('model')!.reset(null, { emitEvent: false });
        this.form.get('make')!.disable();
        this.form.get('model')!.disable();
        this.makes.set([]);
        this.models.set([]);
        this.modelSelected.set(false);
        this.clearVehicleDetails();

        if (result.engine)       this.form.get('engine')!.setValue(result.engine);
        if (result.driveType)    this.form.get('driveType')!.setValue(result.driveType);
        if (result.transmission) this.form.get('transmission')!.setValue(result.transmission);
        if (result.fuelType)     this.form.get('fuelType')!.setValue(result.fuelType);
        if (result.bodyStyle)    this.form.get('bodyStyle')!.setValue(result.bodyStyle);

        const hasExtra = !!(result.engine || result.driveType || result.transmission || result.fuelType || result.bodyStyle || result.subModel);
        if (hasExtra) this.vinFilledDetails.set(true);

        // Year → makes → model cascade requires timeouts
        if (result.year) {
          this.form.get('year')!.setValue(result.year, { emitEvent: false });
          this.fetchMakes(result.year);
        }
        if (result.year && result.make) {
          const year = result.year;
          setTimeout(() => {
            const normalizedMake = this.makes().find(
              m => m.toUpperCase() === (result.make ?? '').toUpperCase()
            ) ?? result.make!;
            this.form.get('make')!.setValue(normalizedMake, { emitEvent: false });
            this.fetchModels(year, normalizedMake);

            if (result.model) {
              setTimeout(() => {
                this.form.get('model')!.setValue(result.model, { emitEvent: false });
                this.modelSelected.set(true);
                this.enableVehicleDetails();
                this.fetchTrims(year, normalizedMake, result.model!);
              }, 600);
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
    this.zxingControls?.stop();
    this.zxingControls = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.videoEl = null;
    this.scannerActive.set(false);
  }

  private async runBarcodeDetection(video: HTMLVideoElement): Promise<void> {
    const BarcodeDetector = (window as any)['BarcodeDetector'];
    if (BarcodeDetector) {
      this.runNativeBarcodeDetection(video, BarcodeDetector);
    } else {
      // Safari/iOS has no BarcodeDetector implementation — fall back to a
      // pure-JS decoder (zxing) reading the same camera stream so VIN
      // scanning still works there instead of forcing manual entry.
      await this.runZxingBarcodeDetection(video);
    }
  }

  private runNativeBarcodeDetection(video: HTMLVideoElement, BarcodeDetector: any): void {
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

  private async runZxingBarcodeDetection(video: HTMLVideoElement): Promise<void> {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    try {
      this.zxingControls = await reader.decodeFromStream(video.srcObject as MediaStream, video, (result) => {
        if (!result || !this.scannerActive()) return;
        const val = result.getText()?.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
        if (val && val.length === 17) {
          this.form.get('vin')!.setValue(val);
          this.stopScanner();
          this.decodeVin();
        }
      });
    } catch {
      this.scanError.set('Barcode scanning not supported on this device. Enter VIN manually.');
      this.stopScanner();
    }
  }
}
