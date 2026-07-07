import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

// Opt out of the global error toast for a specific request when the caller
// surfaces the error inline (e.g. the account-delete dialog shows "Incorrect
// password" itself). Usage:
//   http.delete(url, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

// Turn failed API calls into a friendly, user-visible toast instead of a silent
// console error. Only handles calls to our own API; third-party errors pass
// through untouched. The original error still propagates so component-level
// handlers can react too.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const isOurApi = req.url.startsWith(environment.apiUrl);
  const skip = req.context.get(SKIP_ERROR_TOAST);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isOurApi && !skip) {
        toast.error(messageFor(err));
      }
      // A 401 from our own API means the Supabase session Angular still thinks
      // is valid isn't accepted server-side anymore (expired, revoked, or a
      // refresh that silently failed). Force a real sign-out so the app falls
      // back to the actual signed-out UI instead of a half-authenticated state
      // (account menu stuck, header showing user chrome with no data behind it).
      if (isOurApi && err.status === 401 && auth.isSignedIn()) {
        auth.signOut();
      }
      return throwError(() => err);
    }),
  );
};

function messageFor(err: HttpErrorResponse): string {
  // status 0 = network failure / CORS / offline (no response received).
  if (err.status === 0) {
    return navigator.onLine
      ? "Can't reach AuraLink right now. Please try again."
      : "You're offline. Check your connection and try again.";
  }
  if (err.status === 401) return 'Your session expired. Please sign in again.';
  if (err.status === 403) return "You don't have access to that.";
  if (err.status === 429) return "You're doing that a bit too fast — give it a moment.";
  if (err.status >= 500) return 'Something went wrong on our end. Please try again shortly.';
  // 4xx we don't specifically handle: prefer a server-provided message if sane.
  const serverMsg = (err.error && (err.error.error || err.error.message)) as string | undefined;
  if (typeof serverMsg === 'string' && serverMsg.length < 200) return serverMsg;
  return 'Something went wrong. Please try again.';
}
