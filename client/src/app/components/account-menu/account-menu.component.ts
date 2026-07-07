import {
  Component, ElementRef, HostListener, OnDestroy, ViewChild,
  ViewContainerRef, ComponentRef, effect, inject, signal, Type,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccountService } from '../../services/account.service';
import { AuthService } from '../../services/auth.service';
import { ProfilePanelComponent } from '../account-panels/profile-panel/profile-panel.component';
import { VehiclesPanelComponent } from '../account-panels/vehicles-panel/vehicles-panel.component';
import { SettingsPanelComponent } from '../account-panels/settings-panel/settings-panel.component';

type AccountPanel = 'profile' | 'vehicles' | 'settings' | null;

// Header account entry point. Backed by real Supabase Auth: shows a "Sign in"
// button when signed out, and the account menu (with a working Sign out) when
// signed in. Account data is (re)loaded whenever the signed-in state flips true.
@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './account-menu.component.html',
  styleUrl: './account-menu.component.scss',
})
export class AccountMenuComponent implements OnDestroy {
  @ViewChild('host') hostRef?: ElementRef<HTMLElement>;

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  open = signal(false);
  activePanel = signal<AccountPanel>(null);

  // Panels render as a *modal*, so they must not inherit any ancestor's CSS
  // containing-block (position: fixed is relative to the nearest ancestor
  // with a transform/filter/backdrop-filter, not always the viewport — and
  // .app-header's backdrop-filter was doing exactly that, squashing the
  // modal into the 60px header instead of centering on the page). Fixed by
  // creating each panel directly under <body> instead of inside the header.
  private panelRef: ComponentRef<ProfilePanelComponent | VehiclesPanelComponent | SettingsPanelComponent> | null = null;

  // Tracks whether account data has already been loaded for the current
  // session, so a token refresh (which re-emits a new session object and would
  // otherwise look like a fresh sign-in to this effect) doesn't re-fetch
  // everything from scratch.
  private accountLoaded = false;

  constructor(protected accountService: AccountService, private vcr: ViewContainerRef) {
    // Load account data on sign-in (once); clear it on sign-out.
    effect(() => {
      if (this.auth.isSignedIn()) {
        if (!this.accountLoaded) {
          this.accountLoaded = true;
          this.accountService.loadAll();
        }
      } else {
        this.accountLoaded = false;
        this.accountService.clear();
        this.open.set(false);
        this.closePanel();
      }
    });
  }

  ngOnDestroy(): void {
    this.panelRef?.destroy();
  }

  get initial(): string {
    const name = this.accountService.account()?.displayName ?? '';
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  retryLoad(): void {
    this.accountService.loadAll();
  }

  toggleMenu(): void {
    // Signed out: the trigger is a direct route to the login page.
    if (!this.auth.isSignedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.open.update(v => !v);
  }

  // Navigate to a full page (vs. the slide-in panels) and close the menu.
  goTo(route: string): void {
    this.open.set(false);
    this.router.navigate([route]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const host = this.hostRef?.nativeElement;
    if (host && !host.contains(event.target as Node)) this.open.set(false);
  }

  openPanel(panel: AccountPanel): void {
    this.activePanel.set(panel);
    this.open.set(false);
    this.mountPanel(panel);
  }

  closePanel(): void {
    this.activePanel.set(null);
    this.panelRef?.destroy();
    this.panelRef = null;
  }

  private mountPanel(panel: AccountPanel): void {
    this.panelRef?.destroy();
    this.panelRef = null;
    if (!panel) return;

    const componentType = {
      profile: ProfilePanelComponent,
      vehicles: VehiclesPanelComponent,
      settings: SettingsPanelComponent,
    }[panel] as Type<ProfilePanelComponent | VehiclesPanelComponent | SettingsPanelComponent>;

    this.panelRef = this.vcr.createComponent(componentType);
    this.panelRef.instance.closed.subscribe(() => this.closePanel());
    document.body.appendChild(this.panelRef.location.nativeElement);
  }

  async signOut(): Promise<void> {
    this.open.set(false);
    await this.auth.signOut();
    // The effect above clears account state; send the user home.
    this.router.navigate(['/home']);
  }
}
