// Live + historical vehicle telemetry (Dashboard). A premium feature that will
// eventually stream from the AuraLink Bluetooth adapter; for now the data is
// mocked (see TelemetryService).

// Each metric maps to a real OBD2 data source. Most are standard SAE J1979
// Mode 01 PIDs (queryable on virtually any post-1996 vehicle); the caveats
// below matter when wiring the real adapter — see the per-metric notes in
// TelemetryService.metrics.
export type MetricKey =
  | 'speed'      // PID 0x0D — Vehicle Speed (mandatory, universal)
  | 'rpm'        // PID 0x0C — Engine RPM (mandatory, universal)
  | 'battery'    // NOT a standard PID — read via adapter (ELM327 `AT RV`); ~PID 0x42 "Control Module Voltage" is close
  | 'coolant'    // PID 0x05 — Engine Coolant Temp (mandatory, universal)
  | 'fuel'       // PID 0x2F — Fuel Tank Level (standard but inconsistently supported)
  | 'intake'     // PID 0x0F — Intake Air Temp (standard, widely but not universally supported)
  | 'load'       // PID 0x04 — Calculated Engine Load
  | 'throttle'   // PID 0x11 — Throttle Position
  | 'maf'        // PID 0x10 — Mass Air Flow rate
  | 'fuelTrim'   // PID 0x06/0x07 — Short/Long Term Fuel Trim (Bank 1); shown here as short-term
  | 'ambient'    // PID 0x46 — Ambient Air Temp
  | 'fuelRate';  // PID 0x5E — Engine Fuel Rate

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  icon: string;
  // The real OBD2 source for this metric — a J1979 Mode 01 PID (e.g. '0x0D')
  // or an adapter command ('AT RV' for battery voltage). Documentation only for
  // now; used when the mock TelemetryService is swapped for the real adapter.
  pid: string;
  // Accent color (a theme token name → CSS var) for this metric's gauge + line.
  colorVar: string;
  // Expected operating range, used to scale the gauge arc and y-axis.
  min: number;
  max: number;
  // Optional "healthy" band; readings outside it render as a warning.
  warnBelow?: number;
  warnAbove?: number;
  // Decimal places to show for the live value.
  decimals: number;
}

export interface Sample {
  t: number;      // epoch ms
  value: number;
}

export interface MetricSeries {
  key: MetricKey;
  current: number;
  history: Sample[];
}
