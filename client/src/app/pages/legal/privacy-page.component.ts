import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../components/shared/icon/icon.component';// Public Privacy Policy page. Static, trusted content. Plain-English TEMPLATE
// naming AuraLink's real data flows (Supabase, Gemini, Google Maps, Stripe-later)
// as GDPR/CCPA require. NOT lawyer-reviewed — inline .legal-flag blocks mark what
// an attorney must confirm (legal basis, data-processing agreements, retention,
// international transfer, and the list of sub-processors).
@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './privacy-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class PrivacyPageComponent {
  readonly effectiveDate = 'July 5, 2026';
}
