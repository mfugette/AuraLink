import {
  Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output,
  computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { IconComponent } from '../shared/icon/icon.component';
import { PixelTitleComponent } from '../shared/pixel-title/pixel-title.component';

// One row of the terminal form.
//   options — ghost-completes + drops a completion list (make/model)
//   number  — literal numeric entry; may still ghost from options w/o a list (year)
//   text    — literal free-text (engine); may ghost from options if a pool exists (trim)
//   chips   — options shown inline as selectable [OPT] chips, no input (drive/trans/fuel)
//   primary — Y/n toggle
type FieldKind = 'options' | 'text' | 'number' | 'chips' | 'primary';

interface TermField {
  key: keyof Vehicle | 'nickname' | 'primary';
  prompt: string;        // the "make$" label
  kind: FieldKind;
  // For options fields, a getter for the current candidate list (async-driven).
  optionsOf?: () => string[];
  // Disabled until its parent resolves (make needs year; model needs make).
  enabledOf?: () => boolean;
}

// Terminal-style vehicle form used on the Vehicle Summary page. Renders as a real
// console readout: an ASCII banner of the vehicle's name, then one line per field
// (`field$ …… value`). Editing a line puts a live prompt on the left; the closest
// option ghost-completes ahead of the cursor in dim grey and a quiet match list
// shows the alternatives. Enter/Tab/blur commits and advances to the next field.
//
// Drives the same year→make→model→trim cascade as VehicleSelectorComponent (via
// VehicleService) and emits a Vehicle on every change, so it's a drop-in for the
// editor. The shared CustomSelectComponent is untouched — this is its own control.
@Component({
  selector: 'app-vehicle-terminal',
  standalone: true,
  imports: [CommonModule, IconComponent, PixelTitleComponent],
  templateUrl: './vehicle-terminal.component.html',
  styleUrl: './vehicle-terminal.component.scss',
})
export class VehicleTerminalComponent implements OnInit, OnDestroy {
  // Seed for edit mode (drives the cascade so the vehicle is fully populated).
  @Input() initialVehicle: Vehicle | null = null;
  @Input() initialNickname = '';
  @Input() initialPrimary = false;
  // Whether any OTHER vehicle is already primary — flips the primary default
  // hint between Y/n (none set) and y/N (one already set).
  @Input() otherPrimaryExists = false;

  @Output() vehicleChanged = new EventEmitter<Vehicle>();
  @Output() nicknameChanged = new EventEmitter<string>();
  @Output() primaryChanged = new EventEmitter<boolean>();
  @Output() vinRequested = new EventEmitter<string>();

  private readonly destroy$ = new Subject<void>();

  // ── Model state ───────────────────────────────────────────────────────────────
  readonly nickname = signal('');
  readonly primary = signal(false);
  private readonly v = signal<Vehicle>({
    year: null, make: null, model: null, subModel: null, engine: null,
    driveType: null, transmission: null, fuelType: null, bodyStyle: null,
    mileage: null, vin: null,
  });

  // Async option pools for the cascade.
  private years: number[] = [];
  readonly makes = signal<string[]>([]);
  readonly models = signal<string[]>([]);
  readonly trims = signal<string[]>([]);
  readonly loading = signal<Record<string, boolean>>({});

  private readonly driveTypes = ['FWD', 'RWD', 'AWD', '4WD'];
  private readonly transmissions = ['Automatic', 'Manual', 'CVT', 'DCT'];
  private readonly fuelTypes = ['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric', 'Flex Fuel'];

  // ── Which line is being edited + its live draft ──────────────────────────────
  readonly editingKey = signal<string | null>(null);
  readonly draft = signal('');

  // Last year-entry error (out of range / non-numeric), cleared on a valid entry.
  private readonly yearError = signal<string | null>(null);

  // ── VIN barcode scanner ────────────────────────────────────────────────────────
  // The [SCAN] chip on the vin line opens a camera overlay that reads the VIN
  // barcode (door-jamb / windshield sticker) and drops the decoded VIN into the
  // form. Mirrors VehicleSelectorComponent's scanner, self-contained here.
  readonly scannerActive = signal(false);
  readonly scanError = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private zxingControls: IScannerControls | null = null;

  // Aggregated red error lines shown beneath all the fields. Year is the first
  // user; make/model surface as "required" once a year is set but they're blank.
  readonly errors = computed<string[]>(() => {
    const out: string[] = [];
    const ye = this.yearError();
    if (ye) out.push(ye);
    const v = this.v();
    if (v.year != null && !v.make) out.push('make is required');
    if (v.make && !v.model) out.push('model is required');
    if (v.vin && v.vin.replace(/\s/g, '').length !== 17) out.push('vin must be 17 characters');
    return out;
  });

  // The ordered field list (banner uses nickname; primary is last).
  readonly fields: TermField[] = [
    { key: 'nickname', prompt: 'name',     kind: 'text' },
    { key: 'vin',      prompt: 'vin',      kind: 'text' },
    // Year ghosts against the valid-year list but shows NO completion list.
    { key: 'year',     prompt: 'year',     kind: 'number',
      optionsOf: () => this.years.map(String) },
    { key: 'make',     prompt: 'make',     kind: 'options',
      optionsOf: () => this.makes(), enabledOf: () => this.v().year != null },
    { key: 'model',    prompt: 'model',    kind: 'options',
      optionsOf: () => this.models(), enabledOf: () => !!this.v().make },
    { key: 'subModel', prompt: 'trim',     kind: 'text', optionsOf: () => this.trims() },
    { key: 'engine',   prompt: 'engine',   kind: 'text' },
    // Drive/transmission/fuel are picked inline as [OPT] chips — no input, no list.
    { key: 'driveType', prompt: 'drive',   kind: 'chips', optionsOf: () => this.driveTypes },
    { key: 'transmission', prompt: 'transmission', kind: 'chips', optionsOf: () => this.transmissions },
    { key: 'fuelType', prompt: 'fuel',     kind: 'chips', optionsOf: () => this.fuelTypes },
    { key: 'mileage',  prompt: 'odometer', kind: 'number' },
    { key: 'primary',  prompt: 'primary',  kind: 'primary' },
  ];

  constructor(private vehicleService: VehicleService, private host: ElementRef<HTMLElement>) {}

  // ── Banner ────────────────────────────────────────────────────────────────────
  // The wordmark itself is rendered by the shared <app-pixel-title>; we only
  // supply the label (nickname) + the tagline/vin lines beside it.
  readonly tagline = computed(() => {
    const v = this.v();
    const parts = [v.year, v.make, v.model].filter(Boolean);
    return parts.length ? parts.join(' ') : 'new vehicle';
  });
  readonly vinLine = computed(() => this.v().vin || '—');

  ngOnInit(): void {
    this.years = this.vehicleService.getYears();
    if (this.initialNickname) this.nickname.set(this.initialNickname);
    this.primary.set(this.initialPrimary);
    if (this.initialVehicle) this.seed(this.initialVehicle);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopScanner();
  }

  // ── VIN scanner ────────────────────────────────────────────────────────────────
  // Toggle the camera overlay from the [SCAN] chip.
  toggleScanner(): void {
    if (this.scannerActive()) this.stopScanner();
    else this.startScanner();
  }

  async startScanner(): Promise<void> {
    this.scanError.set(null);
    this.scannerActive.set(true);
    // Wait a tick for the <video> overlay to render before wiring the stream.
    setTimeout(async () => {
      const videoEl = this.host.nativeElement.querySelector<HTMLVideoElement>('.vt-scan-video');
      if (!videoEl) return;
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoEl.srcObject = this.stream;
        await videoEl.play();
        this.runBarcodeDetection(videoEl);
      } catch {
        this.scannerActive.set(false);
        this.scanError.set('Camera access denied. Enter your VIN manually.');
      }
    }, 50);
  }

  stopScanner(): void {
    this.zxingControls?.stop();
    this.zxingControls = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.scannerActive.set(false);
  }

  // A VIN was read from the barcode — set it, close the scanner, request a decode.
  private onVinScanned(vin: string): void {
    this.patch({ vin });
    this.stopScanner();
    this.vinRequested.emit(vin);
  }

  private async runBarcodeDetection(video: HTMLVideoElement): Promise<void> {
    const BarcodeDetector = (window as any)['BarcodeDetector'];
    if (BarcodeDetector) this.runNativeBarcodeDetection(video, BarcodeDetector);
    else await this.runZxingBarcodeDetection(video);
  }

  private runNativeBarcodeDetection(video: HTMLVideoElement, BarcodeDetector: any): void {
    const detector = new BarcodeDetector({ formats: ['code_39', 'code_128', 'data_matrix'] });
    const scan = async () => {
      if (!this.scannerActive()) return;
      try {
        const barcodes = await detector.detect(video);
        for (const barcode of barcodes) {
          const val = barcode.rawValue?.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
          if (val && val.length === 17) { this.onVinScanned(val); return; }
        }
      } catch { /* continue scanning */ }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }

  // Safari/iOS has no BarcodeDetector — fall back to a pure-JS decoder (zxing).
  private async runZxingBarcodeDetection(video: HTMLVideoElement): Promise<void> {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    try {
      this.zxingControls = await reader.decodeFromStream(video.srcObject as MediaStream, video, result => {
        if (!result || !this.scannerActive()) return;
        const val = result.getText()?.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
        if (val && val.length === 17) this.onVinScanned(val);
      });
    } catch {
      this.scanError.set('Barcode scanning not supported on this device. Enter VIN manually.');
      this.stopScanner();
    }
  }

  // ── Reading committed display values ─────────────────────────────────────────
  displayValue(f: TermField): string {
    if (f.key === 'nickname') return this.nickname();
    if (f.key === 'primary') return this.primary() ? 'yes' : 'no';
    const raw = this.v()[f.key as keyof Vehicle];
    return raw == null || raw === '' ? '' : String(raw);
  }

  isEnabled(f: TermField): boolean {
    return f.enabledOf ? f.enabledOf() : true;
  }

  isLoading(f: TermField): boolean {
    return !!this.loading()[f.key as string];
  }

  // Option-backed select fields whose committed value is shown in [ ] brackets
  // (so the readout signals "this is a select"), matching the chip fields.
  // make/model are `options`; trim is `text` but still option-backed.
  isSelectField(f: TermField): boolean {
    return f.key === 'make' || f.key === 'model' || f.key === 'subModel';
  }

  // ── Options / ghost completion ───────────────────────────────────────────────
  private optionsFor(f: TermField): string[] {
    return f.optionsOf ? f.optionsOf() : [];
  }

  // Matches for the current draft, rendered as the inline bracketed option chips
  // below a select field. Behaves like autocomplete: prefix matches drive the
  // narrowing (so typing "A" → makes starting with A, not everything containing
  // an "a"). Substring is only a fallback when NOTHING matches by prefix, so a
  // stray query still finds something instead of showing an empty block. Capped
  // so an unfiltered list (make has 60+) wraps to a sane block.
  matches(f: TermField): string[] {
    const q = this.draft().trim().toLowerCase();
    const opts = this.optionsFor(f);
    if (!q) return opts.slice(0, 40);
    const pre = opts.filter(o => o.toLowerCase().startsWith(q));
    if (pre.length) return pre.slice(0, 40);
    return opts.filter(o => o.toLowerCase().includes(q)).slice(0, 40);
  }

  // The top match used for the inline ghost. Fires for any field backed by an
  // option pool (options + year-as-number + trim-as-text); never for chips/primary.
  topMatch(f: TermField): string | null {
    if (f.kind === 'chips' || f.kind === 'primary') return null;
    if (!(f.optionsOf && this.optionsFor(f).length)) return null;
    return this.matches(f)[0] ?? null;
  }

  // Options shown as bracketed chips beneath a select field while it's being
  // edited (make/model/trim). Filtered by what's typed; capped so a huge make
  // list stays manageable. Empty when nothing's editing or the field isn't a
  // select-with-pool.
  editOptions(f: TermField): string[] {
    if (this.editingKey() !== f.key) return [];
    if (!this.isSelectField(f)) return [];
    return this.matches(f);
  }

  // While editing a SELECT field, the fields below it are hidden — the space is
  // taken over by that field's inline bracketed options. Index of that field, or
  // -1 when no select is being edited.
  private editingSelectIndex(): number {
    const key = this.editingKey();
    if (!key) return -1;
    const idx = this.fields.findIndex(x => x.key === key);
    if (idx < 0) return -1;
    return this.isSelectField(this.fields[idx]) ? idx : -1;
  }

  // Whether a given field's line is currently hidden (it sits below the select
  // field being edited).
  isHiddenWhileEditing(f: TermField): boolean {
    const sel = this.editingSelectIndex();
    if (sel < 0) return false;
    return this.fields.indexOf(f) > sel;
  }

  // Whether the inline option block should render under this field.
  showEditOptions(f: TermField): boolean {
    return this.editingKey() === f.key && this.isSelectField(f);
  }

  // The dim grey remainder shown after the typed text (e.g. typed "SUB" → "ARU").
  ghostRemainder(f: TermField): string {
    const top = this.topMatch(f);
    const typed = this.draft();
    if (!top || !typed) return '';
    if (top.toLowerCase().startsWith(typed.toLowerCase())) return top.slice(typed.length);
    return '';
  }

  // ── Editing lifecycle ────────────────────────────────────────────────────────
  startEdit(f: TermField): void {
    if (!this.isEnabled(f)) return;
    if (f.kind === 'primary') { this.togglePrimary(); return; }
    if (f.kind === 'chips') return;   // chips are picked directly, not "edited"
    this.openChipKey.set(null);       // close any reopened chip row
    this.editingKey.set(f.key as string);
    this.draft.set(this.displayValue(f));
    // Prime option pools that depend on nothing but the current identity.
    if (f.key === 'subModel') this.ensureTrims();
    this.focusActiveInput();   // defers internally until the input has rendered
  }

  // A chip field (drive/transmission/fuel) that's been RE-OPENED to change an
  // already-set value — shows all options again with the current pick bright and
  // the rest dimmed. null when no chip field is reopened.
  readonly openChipKey = signal<string | null>(null);

  // True when a chip field should render its full option row: either nothing is
  // picked yet, or it's been reopened to change the pick.
  chipOpen(f: TermField): boolean {
    return !this.displayValue(f) || this.openChipKey() === f.key;
  }

  // Click the settled [OPT] to reopen the row (bring the greyed options back).
  reopenChip(f: TermField): void {
    if (!this.isEnabled(f)) return;
    this.openChipKey.set(f.key as string);
  }

  // Pick an option from an (open) chip row: commit it and close the row.
  selectChip(f: TermField, value: string): void {
    if (!this.isEnabled(f)) return;
    this.applyValue(f, value);
    this.openChipKey.set(null);
  }

  isChipSelected(f: TermField, value: string): boolean {
    return this.displayValue(f) === value;
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    // Typing in the vin field clears any leftover scanner error immediately.
    if (this.editingKey() === 'vin' && this.scanError()) this.scanError.set(null);
  }

  onKeydown(f: TermField, e: KeyboardEvent): void {
    switch (e.key) {
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        this.commit(f, /*advance*/ true);
        break;
      case 'Escape':
        e.preventDefault();
        this.cancelEdit();
        break;
      case 'ArrowRight':
        // Accept the ghost with Right-arrow at end of input (bash-style).
        if (this.ghostRemainder(f)) {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            this.draft.set(this.topMatch(f)!);
          }
        }
        break;
    }
  }

  // Clicking a match in the list picks it and commits.
  pickMatch(f: TermField, value: string): void {
    this.draft.set(value);
    this.commit(f, /*advance*/ true);
  }

  // Blur commits in place (no advance) unless a list click is mid-flight.
  onBlur(f: TermField): void {
    // Delay so a mousedown on the match list wins over blur.
    setTimeout(() => {
      if (this.editingKey() === f.key) this.commit(f, /*advance*/ false);
    }, 120);
  }

  cancelEdit(): void {
    this.editingKey.set(null);
    this.draft.set('');
  }

  private commit(f: TermField, advance: boolean): void {
    // Resolve the committed value: ghost-completed top match if the draft is a
    // clean prefix of it, else the literal draft.
    let value = this.draft().trim();
    const top = this.topMatch(f);
    if (top && value && top.toLowerCase().startsWith(value.toLowerCase())) value = top;

    this.applyValue(f, value);
    this.editingKey.set(null);
    this.draft.set('');

    // A full VIN triggers an async decode that fills year/make/model itself —
    // don't auto-advance into `year`, or the decode would land on a line the user
    // is mid-editing and wipe the make/model it just resolved.
    const isFullVin = f.key === 'vin' && value.replace(/\s/g, '').length === 17;
    if (advance && !isFullVin) this.advanceFrom(f);
  }

  private advanceFrom(f: TermField): void {
    for (let i = this.fields.indexOf(f) + 1; i < this.fields.length; i++) {
      const next = this.fields[i];
      if (!this.isEnabled(next)) continue;
      // Only auto-open typeable fields — chips/primary are picked by hand.
      if (next.kind === 'chips' || next.kind === 'primary') continue;
      this.startEdit(next);
      return;
    }
  }

  // Focus the freshly-rendered input for the line now being edited so the caret
  // is ready to type immediately (on click or tab-advance). We query the live DOM
  // for `.vt-line.editing .vt-input` rather than trusting @ViewChildren, whose
  // QueryList doesn't update until the *next* change-detection pass — by then the
  // `@if` that renders this input may not have run yet, so `.first` is stale. A
  // macrotask (setTimeout 0) reliably runs after Angular renders the new line.
  private focusActiveInput(): void {
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLInputElement>('.vt-line.editing .vt-input');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }

  // ── Applying a committed value + driving the cascade ─────────────────────────
  private applyValue(f: TermField, value: string): void {
    if (f.key === 'nickname') {
      this.nickname.set(value);
      this.nicknameChanged.emit(value);
      return;
    }

    switch (f.key) {
      case 'vin': {
        // Any manual VIN entry clears a stale scanner error (e.g. "camera denied").
        this.scanError.set(null);
        this.patch({ vin: value ? value.toUpperCase() : null });
        // Offer a decode when a full VIN is entered (parent wires the actual call).
        if (value && value.replace(/\s/g, '').length === 17) this.vinRequested.emit(value.toUpperCase());
        break;
      }
      case 'year': {
        const n = value ? Number(value.replace(/[^\d]/g, '')) : null;
        if (n != null && this.years.includes(n)) {
          this.yearError.set(null);
          this.patch({ year: n });
          this.onYearChanged(n);
        } else if (value) {
          // Out-of-range / non-numeric: surface a red error, don't touch the model.
          const lo = this.years[this.years.length - 1];
          const hi = this.years[0];
          this.yearError.set(`year must be a number between ${lo} and ${hi}`);
        } else {
          this.yearError.set(null);
          this.patch({ year: null });
          this.onYearChanged(null);
        }
        break;
      }
      case 'make':
        this.patch({ make: value || null });
        this.onMakeChanged(this.v().make);
        break;
      case 'model':
        this.patch({ model: value || null });
        this.onModelChanged(this.v().model);
        break;
      case 'mileage': {
        const n = value ? Number(value.replace(/[^\d]/g, '')) : null;
        this.patch({ mileage: Number.isFinite(n) ? n : null });
        break;
      }
      default:
        // subModel/engine/driveType/transmission/fuelType — straight string set.
        this.patch({ [f.key]: value || null } as Partial<Vehicle>);
    }
  }

  private patch(part: Partial<Vehicle>): void {
    this.v.update(cur => ({ ...cur, ...part }));
    this.vehicleChanged.emit(this.v());
  }

  togglePrimary(): void {
    this.primary.update(p => !p);
    this.primaryChanged.emit(this.primary());
  }

  // The Y/n hint: capital letter is the default. If another vehicle is already
  // primary, the default is "no" (y/N); otherwise "yes" (Y/n).
  readonly primaryHint = computed(() => (this.otherPrimaryExists ? 'y/N' : 'Y/n'));

  // ── Cascade (mirrors VehicleSelectorComponent, minus the reactive form) ──────
  private setLoading(key: string, on: boolean): void {
    this.loading.update(m => ({ ...m, [key]: on }));
  }

  private onYearChanged(year: number | null): void {
    const prevMake = this.v().make;
    this.makes.set([]);
    this.models.set([]);
    if (year == null) { this.patch({ make: null, model: null }); return; }

    this.setLoading('make', true);
    this.vehicleService.getMakes(year).pipe(takeUntil(this.destroy$)).subscribe({
      next: makes => {
        this.makes.set(makes);
        this.setLoading('make', false);
        // Keep make/model if still valid for the new year.
        if (prevMake && makes.some(m => m.toUpperCase() === prevMake.toUpperCase())) {
          this.onMakeChanged(prevMake);
        } else {
          this.patch({ make: null, model: null });
        }
      },
      error: () => this.setLoading('make', false),
    });
  }

  private onMakeChanged(make: string | null): void {
    const prevModel = this.v().model;
    this.models.set([]);
    this.trims.set([]);
    const year = this.v().year;
    if (!make || !year) { this.patch({ model: null }); return; }

    // Normalize casing against the fetched list when possible.
    const normalized = this.makes().find(m => m.toUpperCase() === make.toUpperCase()) ?? make;
    if (normalized !== make) this.patch({ make: normalized });

    this.setLoading('model', true);
    this.vehicleService.getModels(year, normalized).pipe(takeUntil(this.destroy$)).subscribe({
      next: models => {
        this.models.set(models);
        this.setLoading('model', false);
        if (prevModel && models.includes(prevModel)) this.onModelChanged(prevModel);
        else this.patch({ model: null });
      },
      error: () => this.setLoading('model', false),
    });
  }

  private onModelChanged(model: string | null): void {
    this.trims.set([]);
    if (!model) return;
    this.ensureTrims();
  }

  private ensureTrims(): void {
    const { year, make, model } = this.v();
    if (!year || !make || !model || this.trims().length) return;
    this.setLoading('subModel', true);
    this.vehicleService.getTrims(year, make, model).pipe(takeUntil(this.destroy$)).subscribe({
      next: trims => {
        this.trims.set(trims.map(t => t.label));
        this.setLoading('subModel', false);
      },
      error: () => this.setLoading('subModel', false),
    });
  }

  // ── Edit-mode seeding ────────────────────────────────────────────────────────
  private seed(v: Vehicle): void {
    // Set instance details straight away; drive the identity cascade with timeouts
    // so each async pool is present before the next selection is applied.
    this.v.set({ ...v });
    this.vehicleChanged.emit(this.v());
    if (v.year == null) return;

    this.setLoading('make', true);
    this.vehicleService.getMakes(v.year).pipe(takeUntil(this.destroy$)).subscribe({
      next: makes => {
        this.makes.set(makes);
        this.setLoading('make', false);
        if (!v.make) return;
        const nMake = makes.find(m => m.toUpperCase() === v.make!.toUpperCase()) ?? v.make;
        this.setLoading('model', true);
        this.vehicleService.getModels(v.year!, nMake).pipe(takeUntil(this.destroy$)).subscribe({
          next: models => {
            this.models.set(models);
            this.setLoading('model', false);
            if (v.model) this.ensureTrims();
          },
          error: () => this.setLoading('model', false),
        });
      },
      error: () => this.setLoading('make', false),
    });
  }

  /** Merge decoded VIN fields in (called by the parent after a decode). */
  applyDecoded(part: Partial<Vehicle>): void {
    this.v.update(cur => ({ ...cur, ...part }));
    this.vehicleChanged.emit(this.v());
    if (part.year) this.onYearChanged(part.year);
  }
}
