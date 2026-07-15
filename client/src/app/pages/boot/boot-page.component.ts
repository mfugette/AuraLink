import {
  AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AccountService } from '../../services/account.service';

// ASCII wordmark printed as the boot banner — mirrors the Aura terminal's banner
// but branded AURALINK, since this is the app-level session boot, not Aura.
const BANNER = String.raw`
  ▄▀█ █░█ █▀█ ▄▀█ █░░ █ █▄░█ █▄▀   ▶ session boot
  █▀█ █▄█ █▀▄ █▀█ █▄▄ █ █░▀█ █░█   v1.0`;

// One line of the boot log.
interface BootLine {
  // The command echoed at the prompt (shown after a `$`), or null for an
  // output-only status line.
  cmd?: string;
  // The status text printed as terminal output.
  out: string;
  // Trailing tag rendered green ([ ok ]) — printed once the step "completes".
  ok?: string;
}

// The scripted boot sequence. Each entry prints its command line, then (after a
// short beat) its output + [ ok ]. Purely cosmetic — a themed loading screen
// shown between sign-in and the Home page while account/vehicle data loads.
const SEQUENCE: BootLine[] = [
  { cmd: 'auth --verify-token',        out: 'session authenticated',            ok: 'ok' },
  { cmd: 'auth --refresh-jwt',         out: 'access token refreshed',           ok: 'ok' },
  { cmd: 'account --load-profile',     out: 'loading account profile',          ok: 'ok' },
  { cmd: 'account --load-settings',    out: 'applying saved preferences',       ok: 'ok' },
  { cmd: 'tier --resolve',             out: 'resolving subscription tier',      ok: 'ok' },
  { cmd: 'garage --sync',              out: 'loading vehicle data',             ok: 'ok' },
  { cmd: 'garage --primary',          out: 'selecting primary vehicle',        ok: 'ok' },
  { cmd: 'vin --decode',               out: 'decoding vehicle identifier',      ok: 'ok' },
  { cmd: 'obd --connect',              out: 'establishing adapter link',        ok: 'ok' },
  { cmd: 'obd --fetch-codes',          out: 'fetching diagnostic codes',        ok: 'ok' },
  { cmd: 'obd --clear-cache',          out: 'flushing stale code cache',        ok: 'ok' },
  { cmd: 'telemetry --pull recent',    out: 'reading recent drive telemetry',   ok: 'ok' },
  { cmd: 'telemetry --analyze',        out: 'analyzing drive history',          ok: 'ok' },
  { cmd: 'maintenance --schedule',     out: 'computing service intervals',      ok: 'ok' },
  { cmd: 'notifications --sync',       out: 'syncing notifications',            ok: 'ok' },
  { cmd: 'aura --status',              out: 'priming diagnostic assistant',     ok: 'ok' },
  { cmd: 'theme --apply',              out: 'applying interface theme',         ok: 'ok' },
  { cmd: 'dashboard --render',         out: 'rendering console',                ok: 'ok' },
];

// A full-screen terminal "loading screen" shown right after sign-in. Plays a
// scripted bash-style boot log (echoing commands + [ ok ] statuses) then routes
// on to the real destination (?redirect=, default /home). Rendered as a fixed
// overlay so the app shell (sidebar/header) never peeks through underneath.
@Component({
  selector: 'app-boot-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boot-page.component.html',
  styleUrl: './boot-page.component.scss',
})
export class BootPageComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly account = inject(AccountService);

  @ViewChild('body') bodyRef?: ElementRef<HTMLElement>;

  readonly banner = BANNER;

  // Lines revealed so far; each is { text, done } so the [ ok ] tag can appear a
  // beat after the line prints.
  readonly lines = signal<{ line: BootLine; done: boolean }[]>([]);
  readonly finished = signal(false);

  readonly userName = computed(() => {
    const name = this.account.account()?.displayName?.trim().split(/\s+/)[0];
    return (name || 'driver').toLowerCase();
  });

  private timers: ReturnType<typeof setTimeout>[] = [];
  private redirectTarget = '/home';

  ngAfterViewInit(): void {
    this.redirectTarget = this.route.snapshot.queryParamMap.get('redirect') ?? '/home';
    // Kick off the account/vehicle fetches for real — the boot screen doubles as
    // the wait for this data to warm the Home page's signals.
    this.account.fetchVehicles().subscribe();

    this.playSequence();
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  private playSequence(): void {
    // Timing: each step prints its command, then its [ ok ] a short beat later.
    // Fast, tight cadence — the whole log streams in in well under two seconds.
    const stepGap = 130;   // ms between successive commands
    const okDelay = 70;    // ms after a command before its [ ok ] lands
    let t = 120;           // brief initial pause after the banner

    SEQUENCE.forEach((line, i) => {
      this.timers.push(setTimeout(() => {
        this.lines.update(ls => [...ls, { line, done: false }]);
        this.scrollToEnd();
      }, t));
      this.timers.push(setTimeout(() => {
        this.lines.update(ls => ls.map((l, idx) => (idx === i ? { ...l, done: true } : l)));
        this.scrollToEnd();
      }, t + okDelay));
      t += stepGap;
    });

    // Final "ready" flash, then navigate on.
    this.timers.push(setTimeout(() => {
      this.finished.set(true);
      this.scrollToEnd();
    }, t + 80));
    this.timers.push(setTimeout(() => {
      this.router.navigateByUrl(this.redirectTarget);
    }, t + 420));
  }

  // Let the user skip the animation (click / any key) and jump straight in.
  skip(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.router.navigateByUrl(this.redirectTarget);
  }

  private scrollToEnd(): void {
    queueMicrotask(() => {
      const el = this.bodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
