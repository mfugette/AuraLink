import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ToastService, ToastKind } from '../../services/toast.service';

// App-wide toast + offline surface. Mounted once in the app shell. Reads the
// ToastService signal to render transient messages, and keeps the offline banner
// in sync with the browser's online/offline events.
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);

  private readonly icons: Record<ToastKind, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };
  iconFor(kind: ToastKind): string { return this.icons[kind]; }

  @HostListener('window:online')
  onOnline(): void { this.toast.offline.set(false); }

  @HostListener('window:offline')
  onOffline(): void { this.toast.offline.set(true); }
}
