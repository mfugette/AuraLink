# Icon Mapping — Material → pixelarticons

The app's icons were migrated from Angular Material (`<mat-icon>`) to a pixel-art
set (**pixelarticons v2.2**) rendered through the shared `<app-icon>` component.
This table lists every original Material icon name and the pixelarticons glyph it
now renders. Names are unchanged in templates — `<app-icon name="directions_car">`
uses the same name the old `<mat-icon>directions_car</mat-icon>` did.

To change a glyph: edit its path in
`client/src/app/components/shared/icon/icon-registry.ts` (copy the `<path d="…">`
from `node_modules/pixelarticons/svg/<name>.svg`).

**118 icons.** Rows marked **⚠️ approx** had no exact pixelarticons
match and use the nearest glyph — candidates to revisit.

| Material name (used in templates) | pixelarticons glyph | Notes |
|---|---|---|
| `ac_unit` | `wind` | ⚠️ approx |
| `air` | `wind` | ⚠️ approx |
| `alternate_email` | `at-sign` |  |
| `arrow_back` | `arrow-left` |  |
| `arrow_downward` | `arrow-down` |  |
| `arrow_forward` | `arrow-right` |  |
| `arrow_outward` | `external-link` |  |
| `article` | `article` |  |
| `auto_awesome` | `zap` | ⚠️ approx |
| `autorenew` | `reload` |  |
| `badge` | `contact` |  |
| `bar_chart_4_bars` | `chart` |  |
| `battery_charging_full` | `battery-full` |  |
| `battery_full` | `battery-full` |  |
| `bluetooth` | `signal` | ⚠️ approx |
| `bluetooth_drive` | `signal` | ⚠️ approx |
| `bluetooth_searching` | `signal` | ⚠️ approx |
| `build` | `tool-case` |  |
| `call` | `phone` |  |
| `cancel` | `close` |  |
| `check` | `check` |  |
| `check_circle` | `check-double` |  |
| `checklist` | `clipboard` | ⚠️ approx |
| `chevron_left` | `chevron-left` |  |
| `chevron_right` | `chevron-right` |  |
| `clear_all` | `close` |  |
| `close` | `close` |  |
| `cloud_off` | `cloud` |  |
| `construction` | `tool-case` |  |
| `content_copy` | `copy` |  |
| `credit_card` | `credit-card` |  |
| `dark_mode` | `moon` |  |
| `dashboard` | `grid-2x2-2` | ⚠️ approx |
| `delete_forever` | `trash` |  |
| `delete_outline` | `trash` |  |
| `delete_sweep` | `trash` |  |
| `device_thermostat` | `thermometer` |  |
| `directions_car` | `car` |  |
| `disc_full` | `save` | ⚠️ approx |
| `done_all` | `check-double` |  |
| `donut_large` | `chart` |  |
| `download` | `download` |  |
| `edit` | `pencil` |  |
| `email` | `mail` |  |
| `error` | `square-alert` |  |
| `error_outline` | `info-box` |  |
| `ev_station` | `battery-full` | ⚠️ approx |
| `event_busy` | `calendar-2` | ⚠️ approx |
| `expand_more` | `chevron-down` |  |
| `fact_check` | `clipboard` | ⚠️ approx |
| `favorite` | `heart` |  |
| `filter_alt_off` | `filter` |  |
| `handshake` | `hand` | ⚠️ approx |
| `help_outline` | `info-box` |  |
| `history` | `clock` |  |
| `home` | `home` |  |
| `image_not_supported` | `image` | ⚠️ approx |
| `info` | `info-box` |  |
| `inventory_2` | `package` |  |
| `keyboard` | `keyboard-music` |  |
| `library_add` | `folder-plus` |  |
| `light_mode` | `lightbulb` |  |
| `linear_scale` | `more-horizontal` |  |
| `local_gas_station` | `battery-full` | ⚠️ approx |
| `local_offer` | `barcode` | ⚠️ approx |
| `local_shipping` | `truck` |  |
| `lock` | `lock` |  |
| `lock_reset` | `lock` |  |
| `login` | `login` |  |
| `logout` | `logout` |  |
| `manage_accounts` | `user` |  |
| `map` | `map-pin` |  |
| `menu` | `menu` |  |
| `monitoring` | `chart` |  |
| `more_horiz` | `more-horizontal` |  |
| `my_location` | `map-pin` |  |
| `near_me` | `map-pin` |  |
| `notifications` | `bell` |  |
| `oil_barrel` | `bottle-wine` | ⚠️ approx |
| `open_in_new` | `external-link` |  |
| `person` | `user` |  |
| `progress_activity` | `reload` |  |
| `qr_code_scanner` | `scan-barcode` |  |
| `receipt_long` | `receipt` |  |
| `refresh` | `reload` |  |
| `replay` | `reload` |  |
| `report_problem` | `warning-diamond` |  |
| `restart_alt` | `reload` |  |
| `rocket_launch` | `ship` | ⚠️ approx |
| `route` | `map-pin` |  |
| `search` | `search` |  |
| `search_off` | `search` |  |
| `sell` | `barcode` | ⚠️ approx |
| `send` | `send` |  |
| `settings` | `settings-2` |  |
| `shield` | `shield` |  |
| `shopping_cart` | `shopping-cart` |  |
| `shopping_cart_off` | `shopping-cart` |  |
| `show_chart` | `chart` |  |
| `sms` | `message` |  |
| `speed` | `speed-fast` |  |
| `star` | `star` |  |
| `star_outline` | `star` |  |
| `store` | `store` |  |
| `thermostat` | `thermometer` |  |
| `thermostat_auto` | `thermometer` |  |
| `touch_app` | `hand` | ⚠️ approx |
| `trip_origin` | `circle` |  |
| `tune` | `settings-2` |  |
| `upgrade` | `arrow-up-box` |  |
| `usb` | `power` | ⚠️ approx |
| `verified` | `check-double` |  |
| `verified_user` | `shield` |  |
| `visibility` | `eye` |  |
| `vpn_key` | `lock` |  |
| `warning` | `warning-diamond` |  |
| `water_drop` | `bottle-wine` | ⚠️ approx |
| `workspace_premium` | `trophy` | ⚠️ approx |
