import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

// Attach the Supabase access token to requests hitting our own API. Only our
// API URL gets the Authorization header — third-party calls are left untouched.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;

  if (req.url.startsWith(environment.apiUrl)) {
    req = req.clone({
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
      // The API lives on a different subdomain (api.<host>) behind the same
      // Cloudflare Access gate as the app. Access's session cookie is scoped
      // to each subdomain independently and is cross-origin from the app's
      // point of view, so it's dropped unless the request explicitly opts in
      // to sending credentials — without this, every API call gets Access's
      // login-challenge response instead of reaching Express (this is why it
      // failed universally rather than on one endpoint, and hit mobile
      // browsers first/hardest since they're stricter about cross-site
      // cookies by default).
      withCredentials: true,
    });
  }

  return next(req);
};
