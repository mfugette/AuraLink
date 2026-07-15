import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AiSearchComponent } from './components/ai-search/ai-search.component';
import { AccountMenuComponent } from './components/account-menu/account-menu.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { ToastHostComponent } from './components/toast-host/toast-host.component';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { MatIconModule } from '@angular/material/icon';

// Header wordmark drawn in the same half-block figlet vocabulary as the Aura
// terminal boot banner. Two pieces so each keeps its own color: AURA (white,
// glyphs verbatim from the banner) + LINK (blue accent).
const LOGO_AURA = String.raw`▄▀█ █░█ █▀█ ▄▀█
█▀█ █▄█ █▀▄ █▀█`;
const LOGO_LINK = String.raw`█░░ █ █▄░█ █▄▀
█▄▄ █ █░▀█ █░█`;

// App shell: persistent chrome (top bar with AI search + account menu, a
// collapsible left sidebar) around a <router-outlet>. Full-width, YouTube-style
// layout. The previous single-page hero/lookup flow now lives at /home.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, MatIconModule, MatTooltipModule, SidebarComponent, AiSearchComponent, AccountMenuComponent, NotificationsComponent, ToastHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly logoAura = LOGO_AURA;
  readonly logoLink = LOGO_LINK;

  private readonly router = inject(Router);
  // Injected so it's constructed at app start: applies the theme and wires the
  // account-settings sync. Also exposed to the template for the header toggle.
  protected readonly theme = inject(ThemeService);
  // Guests get a stripped shell: no sidebar, hamburger, or AI search — only the
  // free /home pipeline. The chrome appears once signed in. (Exposed to the
  // template.)
  protected readonly auth = inject(AuthService);

  sidebarCollapsed = signal(true);
  // Separate mobile state: on phones the sidebar isn't part of the layout flow
  // (see .app-sidebar's breakpoint) — instead the hamburger opens it as a
  // fixed overlay drawer on top of the content. Closed by default.
  mobileDrawerOpen = signal(false);

  readonly currentYear = new Date().getFullYear();

  // Hide the top-bar AI search on the dedicated assistant page — it's redundant
  // there since the whole page is the conversation.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  // AI search is a signed-in feature, and it's redundant on the dedicated
  // assistant page (the whole page is the conversation there).
  readonly showAiSearch = () =>
    this.auth.isSignedIn() && !this.currentUrl().startsWith('/assistant');

  // On phones (≤520px) the hamburger toggles the overlay drawer; on larger
  // screens it toggles the in-flow collapse. Matching the CSS breakpoint.
  toggleSidebar(): void {
    if (window.innerWidth <= 520) {
      this.mobileDrawerOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  closeMobileDrawer(): void {
    this.mobileDrawerOpen.set(false);
  }
}
