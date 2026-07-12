import { Component, EventEmitter, Output, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DtcService } from '../../services/dtc.service';
import { DtcCode, SEVERITY_RANK } from '../../models/dtc-code.model';
import { Vehicle } from '../../models/vehicle.model';
import { IconComponent } from '../shared/icon/icon.component';

@Component({
  selector: 'app-live-dtc',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent, MatProgressSpinnerModule,
  ],
  templateUrl: './live-dtc.component.html',
  styleUrl: './live-dtc.component.scss',
})
export class LiveDtcComponent implements OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Output() useCodes = new EventEmitter<{ codes: string[]; vehicle: Vehicle }>();
  @Output() stepChanged = new EventEmitter<number>();

  // 0 = instructions, 1 = connecting/scanning, 2 = detected codes
  step = signal(0);

  // DEMO: fake codes a dongle would "detect". Resolved against the real DTC DB.
  private readonly fakeDetected = ['P0420', 'P0171', 'P0301'];

  // DEMO: a real OBD2 dongle reads the VIN (Mode 09 PID 02) and can report the
  // decoded vehicle alongside the trouble codes — so the vehicle-info form
  // shouldn't sit empty after a scan. Fake but plausible for the demo flow.
  private readonly fakeVehicle: Vehicle = {
    year: 2019, make: 'Honda', model: 'Civic', subModel: 'EX', engine: '1.5L Turbo I4',
    driveType: 'FWD', transmission: 'CVT', fuelType: 'Gasoline', bodyStyle: 'Sedan',
    mileage: null, vin: '2HGFC2F59KH123456',
  };

  readonly detected = computed<DtcCode[]>(() =>
    this.fakeDetected
      .map(c => this.dtcService.lookup(c))
      .filter((c): c is DtcCode => !!c)
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
  );

  // Secondary scanner feature panels
  showFreezeFrame = signal(false);
  showReadiness   = signal(false);
  confirmingClear = signal(false);
  codesCleared    = signal(false);

  readonly freezeFrame = [
    { label: 'Engine RPM',      value: '2,100 rpm'  },
    { label: 'Vehicle Speed',   value: '35 mph'     },
    { label: 'Coolant Temp',    value: '195 °F'     },
    { label: 'Engine Load',     value: '47 %'       },
    { label: 'ST Fuel Trim B1', value: '+12.5 %'    },
    { label: 'MAF Rate',        value: '2.1 g/s'    },
  ];

  readonly readinessMonitors = [
    { name: 'Misfire',      status: 'complete'   },
    { name: 'Fuel System',  status: 'complete'   },
    { name: 'Components',   status: 'complete'   },
    { name: 'Catalyst',     status: 'incomplete' },
    { name: 'O₂ Sensor',   status: 'complete'   },
    { name: 'O₂ Heater',   status: 'complete'   },
    { name: 'Evap System',  status: 'complete'   },
    { name: 'EGR System',   status: 'na'         },
  ];

  toggleFreezeFrame(): void {
    this.showFreezeFrame.update(v => !v);
    if (this.showFreezeFrame()) this.showReadiness.set(false);
  }

  toggleReadiness(): void {
    this.showReadiness.update(v => !v);
    if (this.showReadiness()) this.showFreezeFrame.set(false);
  }

  clearCodes(): void {
    this.confirmingClear.set(false);
    this.codesCleared.set(true);
    setTimeout(() => {
      this.codesCleared.set(false);
      this.setStep(0);
    }, 2000);
  }

  private connectTimer?: ReturnType<typeof setTimeout>;

  // Bluetooth pairing instructions (DEMO copy)
  readonly steps = [
    {
      icon: 'usb',
      title: 'Plug in the dongle',
      text: 'Locate the OBD2 port under your dashboard (usually near the steering column) and plug in your AuraLink Bluetooth adapter.',
    },
    {
      icon: 'vpn_key',
      title: 'Turn the key to ON',
      text: 'Switch the ignition to the ON / accessory position. You don’t need to start the engine — just power up the electronics.',
    },
    {
      icon: 'bluetooth',
      title: 'Pair via Bluetooth',
      text: 'Open your phone’s Bluetooth settings and pair with “AuraLink”. Then come back here and tap Connect.',
    },
  ];

  constructor(private dtcService: DtcService) {}

  ngOnDestroy(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
  }

  private setStep(n: number): void {
    this.step.set(n);
    this.stepChanged.emit(n);
  }

  connect(): void {
    this.setStep(1);
    // DEMO: simulate handshake + scan, then reveal detected codes
    this.connectTimer = setTimeout(() => this.setStep(2), 2800);
  }

  rescan(): void {
    this.setStep(1);
    this.connectTimer = setTimeout(() => this.setStep(2), 2200);
  }

  goBack(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.setStep(0);
    this.back.emit();
  }

  lookupDetected(): void {
    this.useCodes.emit({ codes: this.detected().map(d => d.code), vehicle: this.fakeVehicle });
  }
}
