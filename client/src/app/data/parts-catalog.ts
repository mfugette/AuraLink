// Seed parts catalog for the Part Lookup page. Representative sample across
// common categories — enough to build & demo real search/filter UI. This is a
// stand-in: later it can be replaced by a CarAPI-backed source without changing
// the CatalogPart shape or the PartsCatalogService interface.

export interface CatalogPart {
  id: string;
  name: string;
  category: string;
  partNumber: string;
  brand: string;
  priceLow: number;
  priceHigh: number;
  fitment: string;        // e.g. "Most 2010+ vehicles", "Honda/Acura 1.5L–2.4L"
  description: string;
  relatedCodes: string[]; // DTCs this part commonly addresses
}

export const PART_CATEGORIES = [
  'Brakes',
  'Filters',
  'Sensors',
  'Ignition',
  'Cooling',
  'Belts & Hoses',
  'Fuel System',
  'Emissions',
  'Battery & Electrical',
  'Suspension',
] as const;

export const PARTS_CATALOG: CatalogPart[] = [
  // ── Brakes ──
  { id: 'br-001', name: 'Front Brake Pad Set (Ceramic)', category: 'Brakes', partNumber: 'BP-CER-1121', brand: 'Akebono', priceLow: 38, priceHigh: 72, fitment: 'Most 2008+ passenger cars', description: 'Low-dust ceramic front pads with shims for quiet, fade-resistant stopping.', relatedCodes: [] },
  { id: 'br-002', name: 'Rear Brake Rotor (Vented)', category: 'Brakes', partNumber: 'RT-VNT-3390', brand: 'Bosch', priceLow: 45, priceHigh: 95, fitment: 'Sedans & crossovers, 280–320mm', description: 'G3000 coated vented rotor resists corrosion and warping.', relatedCodes: [] },
  { id: 'br-003', name: 'Brake Caliper (Front, Loaded)', category: 'Brakes', partNumber: 'CAL-LD-7742', brand: 'Cardone', priceLow: 65, priceHigh: 160, fitment: 'Vehicle-specific — verify by trim', description: 'Remanufactured loaded caliper with bracket and pads included.', relatedCodes: [] },

  // ── Filters ──
  { id: 'fl-001', name: 'Engine Air Filter', category: 'Filters', partNumber: 'AF-ENG-2210', brand: 'K&N', priceLow: 15, priceHigh: 55, fitment: 'Most 4-cyl & V6 engines', description: 'High-flow washable filter element; improves intake airflow.', relatedCodes: ['P0171', 'P0174'] },
  { id: 'fl-002', name: 'Cabin Air Filter (Carbon)', category: 'Filters', partNumber: 'CF-CBN-1180', brand: 'Fram', priceLow: 12, priceHigh: 32, fitment: 'Most 2005+ vehicles', description: 'Activated-carbon cabin filter traps pollen, dust, and odors.', relatedCodes: [] },
  { id: 'fl-003', name: 'Oil Filter (Spin-On)', category: 'Filters', partNumber: 'OF-SPN-0455', brand: 'Mobil 1', priceLow: 8, priceHigh: 18, fitment: 'Wide application — verify thread', description: 'Extended-performance oil filter rated for synthetic intervals.', relatedCodes: [] },
  { id: 'fl-004', name: 'Fuel Filter (Inline)', category: 'Filters', partNumber: 'FF-INL-9922', brand: 'ACDelco', priceLow: 14, priceHigh: 40, fitment: 'Return & returnless systems', description: 'Inline fuel filter maintains injector pressure and flow.', relatedCodes: ['P0087', 'P0171'] },

  // ── Sensors ──
  { id: 'sn-001', name: 'Oxygen Sensor (Upstream)', category: 'Sensors', partNumber: 'O2-UP-4420', brand: 'Denso', priceLow: 32, priceHigh: 110, fitment: 'Bank 1 / Bank 2 — verify position', description: 'Direct-fit heated wideband O2 sensor; restores fuel-trim accuracy.', relatedCodes: ['P0130', 'P0135', 'P0141', 'P0420'] },
  { id: 'sn-002', name: 'Mass Air Flow Sensor', category: 'Sensors', partNumber: 'MAF-HW-7781', brand: 'Bosch', priceLow: 55, priceHigh: 210, fitment: 'Hot-wire & hot-film intakes', description: 'Calibrated MAF sensor measures intake air mass for fueling.', relatedCodes: ['P0101', 'P0102', 'P0103', 'P0171'] },
  { id: 'sn-003', name: 'Camshaft Position Sensor', category: 'Sensors', partNumber: 'CMP-3312', brand: 'Delphi', priceLow: 22, priceHigh: 75, fitment: 'Bank 1 intake/exhaust', description: 'Hall-effect cam sensor for timing and sequential injection.', relatedCodes: ['P0340', 'P0341', 'P0010'] },
  { id: 'sn-004', name: 'Crankshaft Position Sensor', category: 'Sensors', partNumber: 'CKP-5590', brand: 'Standard', priceLow: 20, priceHigh: 80, fitment: 'Vehicle-specific mounting', description: 'Detects crank position/speed; a no-start common cause.', relatedCodes: ['P0335', 'P0336'] },
  { id: 'sn-005', name: 'Coolant Temperature Sensor', category: 'Sensors', partNumber: 'ECT-2245', brand: 'ACDelco', priceLow: 10, priceHigh: 35, fitment: 'Threaded into head/housing', description: 'Reports coolant temp to the ECU for fueling and fans.', relatedCodes: ['P0115', 'P0117', 'P0118'] },

  // ── Ignition ──
  { id: 'ig-001', name: 'Ignition Coil Pack', category: 'Ignition', partNumber: 'IC-PK-6610', brand: 'NGK', priceLow: 28, priceHigh: 90, fitment: 'Coil-on-plug engines', description: 'OE-spec coil-on-plug unit; fixes misfires and rough idle.', relatedCodes: ['P0300', 'P0301', 'P0302', 'P0303', 'P0304'] },
  { id: 'ig-002', name: 'Spark Plug Set (Iridium)', category: 'Ignition', partNumber: 'SP-IR-1200', brand: 'Denso', priceLow: 24, priceHigh: 70, fitment: '4–8 cyl, pre-gapped', description: 'Long-life iridium plugs for reliable spark and economy.', relatedCodes: ['P0300', 'P0301'] },

  // ── Cooling ──
  { id: 'cl-001', name: 'Thermostat & Housing', category: 'Cooling', partNumber: 'TH-HS-4408', brand: 'Gates', priceLow: 18, priceHigh: 65, fitment: 'Integrated & standalone', description: 'OE-temp thermostat with housing and seal for stable temps.', relatedCodes: ['P0128', 'P0125'] },
  { id: 'cl-002', name: 'Radiator (Aluminum Core)', category: 'Cooling', partNumber: 'RAD-AL-9931', brand: 'Spectra', priceLow: 90, priceHigh: 240, fitment: 'Vehicle-specific — verify inlet', description: 'Aluminum-core radiator with plastic tanks; direct fit.', relatedCodes: [] },
  { id: 'cl-003', name: 'Water Pump', category: 'Cooling', partNumber: 'WP-2277', brand: 'Aisin', priceLow: 40, priceHigh: 130, fitment: 'Belt & timing-driven', description: 'Cast-impeller water pump with gasket; prevents overheating.', relatedCodes: [] },

  // ── Belts & Hoses ──
  { id: 'bh-001', name: 'Serpentine Belt', category: 'Belts & Hoses', partNumber: 'SB-6PK-2050', brand: 'Gates', priceLow: 16, priceHigh: 45, fitment: '6-rib, verify length', description: 'EPDM serpentine belt resists cracking and squeal.', relatedCodes: [] },
  { id: 'bh-002', name: 'Radiator Upper Hose', category: 'Belts & Hoses', partNumber: 'RH-UP-3311', brand: 'Dayco', priceLow: 12, priceHigh: 38, fitment: 'Molded, vehicle-specific', description: 'Reinforced molded coolant hose; OE routing.', relatedCodes: [] },

  // ── Fuel System ──
  { id: 'fs-001', name: 'Fuel Injector', category: 'Fuel System', partNumber: 'FI-4Hole-8890', brand: 'Bosch', priceLow: 35, priceHigh: 140, fitment: 'Port & GDI — verify type', description: 'Flow-matched injector restores spray pattern and idle.', relatedCodes: ['P0201', 'P0202', 'P0171'] },
  { id: 'fs-002', name: 'Fuel Pump Assembly', category: 'Fuel System', partNumber: 'FP-ASM-7120', brand: 'Delphi', priceLow: 70, priceHigh: 260, fitment: 'In-tank module', description: 'Complete in-tank pump module with sender and strainer.', relatedCodes: ['P0087', 'P0230'] },

  // ── Emissions ──
  { id: 'em-001', name: 'Catalytic Converter (Direct-Fit)', category: 'Emissions', partNumber: 'CAT-DF-5540', brand: 'Walker', priceLow: 120, priceHigh: 420, fitment: 'CARB/EPA — verify compliance', description: 'Direct-fit converter with flanges; resolves efficiency codes.', relatedCodes: ['P0420', 'P0430'] },
  { id: 'em-002', name: 'EGR Valve', category: 'Emissions', partNumber: 'EGR-3380', brand: 'Standard', priceLow: 45, priceHigh: 160, fitment: 'Electronic & vacuum types', description: 'Recirculation valve controls NOx; fixes flow faults.', relatedCodes: ['P0401', 'P0402', 'P0404'] },
  { id: 'em-003', name: 'EVAP Purge Valve', category: 'Emissions', partNumber: 'EVP-1195', brand: 'Dorman', priceLow: 18, priceHigh: 55, fitment: 'Solenoid, vehicle-specific', description: 'Canister purge solenoid; common small-EVAP-leak fix.', relatedCodes: ['P0440', 'P0441', 'P0446', 'P0455'] },
  { id: 'em-004', name: 'Gas Cap (Sealing)', category: 'Emissions', partNumber: 'GC-SEAL-0099', brand: 'Motorad', priceLow: 8, priceHigh: 22, fitment: 'Threaded & cam-lock', description: 'Sealing fuel cap; the cheapest fix for EVAP leak codes.', relatedCodes: ['P0455', 'P0457'] },

  // ── Battery & Electrical ──
  { id: 'be-001', name: 'Alternator (Remanufactured)', category: 'Battery & Electrical', partNumber: 'ALT-RM-6620', brand: 'Denso', priceLow: 95, priceHigh: 300, fitment: 'Amp rating varies — verify', description: 'Remanufactured alternator; restores charging output.', relatedCodes: ['P0562', 'P0563'] },
  { id: 'be-002', name: 'Car Battery (Group 35, AGM)', category: 'Battery & Electrical', partNumber: 'BAT-AGM-035', brand: 'Optima', priceLow: 130, priceHigh: 280, fitment: 'Group 35 fitment', description: 'AGM battery with high cold-cranking amps and deep-cycle life.', relatedCodes: [] },
  { id: 'be-003', name: 'Starter Motor', category: 'Battery & Electrical', partNumber: 'STR-4471', brand: 'Bosch', priceLow: 60, priceHigh: 220, fitment: 'Gear-reduction & direct', description: 'Direct-fit starter; fixes slow-crank and no-crank.', relatedCodes: [] },

  // ── Suspension ──
  { id: 'su-001', name: 'Front Strut Assembly (Loaded)', category: 'Suspension', partNumber: 'ST-LD-8810', brand: 'Monroe', priceLow: 70, priceHigh: 190, fitment: 'Complete quick-strut', description: 'Preassembled strut with spring and mount; ride restore.', relatedCodes: [] },
  { id: 'su-002', name: 'Control Arm w/ Ball Joint', category: 'Suspension', partNumber: 'CA-BJ-2260', brand: 'Moog', priceLow: 45, priceHigh: 150, fitment: 'Lower, vehicle-specific', description: 'Control arm with pressed ball joint and bushings.', relatedCodes: [] },
  { id: 'su-003', name: 'Wheel Hub & Bearing', category: 'Suspension', partNumber: 'HB-5540', brand: 'Timken', priceLow: 40, priceHigh: 130, fitment: 'Front/rear — verify ABS', description: 'Sealed hub assembly with integral ABS tone ring.', relatedCodes: ['C0035', 'C0040'] },
];
