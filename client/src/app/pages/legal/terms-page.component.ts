import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Public Terms of Service page. Content is authored statically in the template
// (trusted). This is a plain-English TEMPLATE tailored to what AuraLink actually
// does — it is NOT lawyer-reviewed. Inline .legal-flag blocks mark clauses that
// specifically need an attorney's eyes before launch (esp. the automotive-advice
// liability limits, which are the highest-risk part of this document).
@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './terms-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class TermsPageComponent {
  readonly effectiveDate = 'July 5, 2026';
}
