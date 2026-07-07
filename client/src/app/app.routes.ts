import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home/home-page.component';
import { PartLookupPageComponent } from './pages/part-lookup/part-lookup-page.component';
import { MyVehiclesPageComponent } from './pages/my-vehicles/my-vehicles-page.component';
import { IssueHistoryPageComponent } from './pages/issue-history/issue-history-page.component';
import { AssistantPageComponent } from './pages/assistant/assistant-page.component';
import { NearbyServicesPageComponent } from './pages/nearby-services/nearby-services-page.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { LoginPageComponent } from './pages/login/login-page.component';
import { PlanPageComponent } from './pages/plan/plan-page.component';
import { CheckoutPageComponent } from './pages/checkout/checkout-page.component';
import { MyPlanPageComponent } from './pages/my-plan/my-plan-page.component';
import { AccountPageComponent } from './pages/account/account-page.component';
import { HistoryPageComponent } from './pages/history/history-page.component';
import { FaqPageComponent } from './pages/faq/faq-page.component';
import { TermsPageComponent } from './pages/legal/terms-page.component';
import { PrivacyPageComponent } from './pages/legal/privacy-page.component';
import { ResetPasswordPageComponent } from './pages/reset-password/reset-password-page.component';
import { AuthCallbackPageComponent } from './pages/auth-callback/auth-callback-page.component';
import { authGuard } from './guards/auth.guard';
import { requireTier } from './guards/tier.guard';

// Only /home (the free DTC pipeline) and /login are reachable by guests.
// Every other page is behind authGuard — a signed-out visitor who navigates
// or types the URL directly is redirected to /home. (Real enforcement of any
// data access lives server-side; see requireAuth on the protected API routes.)
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomePageComponent, title: 'AuraLink — Your driving partner' },
  { path: 'login', component: LoginPageComponent, title: 'Sign in — AuraLink' },
  { path: 'reset-password', component: ResetPasswordPageComponent, title: 'Reset password — AuraLink' },
  { path: 'auth/callback', component: AuthCallbackPageComponent, title: 'Confirming — AuraLink' },
  { path: 'faq', component: FaqPageComponent, title: 'Help & FAQ — AuraLink' },
  { path: 'terms', component: TermsPageComponent, title: 'Terms of Service — AuraLink' },
  { path: 'privacy', component: PrivacyPageComponent, title: 'Privacy Policy — AuraLink' },
  {
    path: 'assistant',
    component: AssistantPageComponent,
    title: 'Aura — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'part-lookup',
    component: PartLookupPageComponent,
    title: 'Part Lookup — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'nearby',
    component: NearbyServicesPageComponent,
    title: 'Find Help Nearby — AuraLink',
    canActivate: [authGuard, requireTier('nearby')],
  },
  {
    path: 'dashboard',
    component: DashboardPageComponent,
    title: 'Live Dashboard — AuraLink',
    canActivate: [authGuard, requireTier('dashboard')],
  },
  {
    path: 'my-vehicles',
    component: MyVehiclesPageComponent,
    title: 'My Vehicles — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'issue-history',
    component: IssueHistoryPageComponent,
    title: 'Issue History — AuraLink',
    canActivate: [authGuard, requireTier('issue-history')],
  },
  {
    path: 'history',
    component: HistoryPageComponent,
    title: 'History — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'plan',
    component: PlanPageComponent,
    title: 'Plans & Pricing — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'checkout',
    component: CheckoutPageComponent,
    title: 'Checkout — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'my-plan',
    component: MyPlanPageComponent,
    title: 'My Plan — AuraLink',
    canActivate: [authGuard],
  },
  {
    path: 'account',
    component: AccountPageComponent,
    title: 'Account — AuraLink',
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'home' },
];
