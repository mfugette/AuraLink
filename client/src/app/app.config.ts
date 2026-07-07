import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { AuraLinkPreset } from './primeng-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // auth attaches the token; error surfaces failures as toasts (runs on the
    // response path after auth).
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    // PrimeNG components are opt-in per-component (import e.g. ButtonModule
    // where used) — this just wires the shared theme so anything you drop in
    // matches AuraLink's existing dark/blue look. See primeng-preset.ts.
    providePrimeNG({
      theme: {
        preset: AuraLinkPreset,
        options: {
          darkModeSelector: false, 
          cssLayer: { name: 'primeng', order: 'reset, primeng' },
        },
      },
    }),
  ],
};
