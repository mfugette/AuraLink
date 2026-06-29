import { Component, EventEmitter, Output, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DtcService } from '../../services/dtc.service';
import { DtcCode, Severity } from '../../models/dtc-code.model';

@Component({
  selector: 'app-live-dtc',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './live-dtc.component.html',
  styleUrl: './live-dtc.component.scss',
})
export class LiveDtcComponent implements OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Output() useCodes = new EventEmitter<string[]>();

  // 0 = instructions, 1 = connecting/scanning, 2 = detected codes
  step = signal(0);

  // DEMO: fake codes a dongle would "detect". Resolved against the real DTC DB.
  private readonly fakeDetected = ['P0420', 'P0171', 'P0301'];

  readonly detected = computed<DtcCode[]>(() =>
    this.fakeDetected
      .map(c => this.dtcService.lookup(c))
      .filter((c): c is DtcCode => !!c)
  );

  private connectTimer?: ReturnType<typeof setTimeout>;

  // Bluetooth pairing instructions (DEMO copy)
  readonly steps = [
    {
      icon: 'usb',
      title: 'Plug in the dongle',
      text: 'Locate the OBD2 port under your dashboard (usually near the steering column) and plug in your OpenOBD Bluetooth adapter.',
    },
    {
      icon: 'vpn_key',
      title: 'Turn the key to ON',
      text: 'Switch the ignition to the ON / accessory position. You don’t need to start the engine — just power up the electronics.',
    },
    {
      icon: 'bluetooth',
      title: 'Pair via Bluetooth',
      text: 'Open your phone’s Bluetooth settings and pair with “OpenOBD”. Then come back here and tap Connect.',
    },
  ];

  constructor(private dtcService: DtcService) {}

  ngOnDestroy(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
  }

  connect(): void {
    this.step.set(1);
    // DEMO: simulate handshake + scan, then reveal detected codes
    this.connectTimer = setTimeout(() => this.step.set(2), 2800);
  }

  rescan(): void {
    this.step.set(1);
    this.connectTimer = setTimeout(() => this.step.set(2), 2200);
  }

  goBack(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.step.set(0);
    this.back.emit();
  }

  lookupDetected(): void {
    this.useCodes.emit(this.detected().map(d => d.code));
  }

  severityIcon(severity: Severity): string {
    return { low: 'check_circle', moderate: 'warning', high: 'error', critical: 'dangerous' }[severity];
  }
}
