import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

// Lazily injects the Google Maps JavaScript SDK exactly once and resolves when
// the "maps" + "marker" libraries are actually usable. Loading it on demand
// (only when the nearby-services page needs a map) keeps it out of the initial
// bundle and off every other page.
//
// With `loading=async`, Google's bootstrap script only installs a stub
// `google.maps` namespace + `importLibrary()` — the real classes (Map, Marker,
// etc.) aren't attached until you call importLibrary() and await it. Resolving
// on script `onload` alone (checking that `google.maps` is merely truthy) is
// NOT enough: the stub is truthy but `google.maps.Map` isn't a constructor yet.
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoader {
  private promise: Promise<typeof google.maps> | null = null;

  load(): Promise<typeof google.maps> {
    if (this.promise) return this.promise;

    this.promise = this.injectScript().then(async () => {
      await google.maps.importLibrary('maps');
      await google.maps.importLibrary('marker');
      return google.maps;
    });

    return this.promise;
  }

  private injectScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') {
        resolve();
        return;
      }

      const key = environment.googleMapsBrowserKey;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__obdMapsReady`;
      script.async = true;

      // The bootstrap loader expects a global callback name, not just onload —
      // onload can fire before the stub finishes installing itself.
      (window as unknown as Record<string, () => void>)['__obdMapsReady'] = () => resolve();
      script.onerror = () => reject(new Error('Could not load Google Maps.'));
      document.head.appendChild(script);
    });
  }
}
