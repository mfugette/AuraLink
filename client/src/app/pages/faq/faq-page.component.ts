import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../components/shared/icon/icon.component';interface FaqItem {
  q: string;
  a: string; // may contain simple inline HTML (links) — authored here, trusted.
}
interface FaqSection {
  title: string;
  icon: string;
  items: FaqItem[];
}

// Public FAQ / help page. Grouped, searchable accordion. Content is authored
// here (static) — no backend. Reachable by guests and members alike.
@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
})
export class FaqPageComponent {
  readonly query = signal('');

  // A unique key per item ("<section>-<index>") for tracking which are open.
  readonly openKeys = signal<Set<string>>(new Set());

  readonly sections: FaqSection[] = [
    {
      title: 'Getting started',
      icon: 'rocket_launch',
      items: [
        {
          q: 'What is AuraLink?',
          a: 'AuraLink helps you understand and manage your vehicle: look up OBD2 fault codes, find the right parts, get AI-powered guidance from Aura, track your issue history, and locate help nearby — all in one place.',
        },
        {
          q: 'Do I need an account to use it?',
          a: 'No. Anyone can use the free fault-code lookup and parts finder without signing up. Creating a free account unlocks saving a vehicle and chatting with Aura, and lets you upgrade for more.',
        },
        {
          q: 'What is an OBD2 code?',
          a: 'OBD2 (On-Board Diagnostics II) is the standard system in every car sold since 1996. When something is wrong, your car stores a Diagnostic Trouble Code (DTC) like "P0420". Enter that code on the home page and AuraLink explains what it means, likely causes, and what to do next.',
        },
      ],
    },
    {
      title: 'Plans & billing',
      icon: 'workspace_premium',
      items: [
        {
          q: 'What do the different plans include?',
          a: 'Free covers code lookup, the parts finder, one saved vehicle, and limited Aura messages. Plus ($0.99/mo) adds issue history, live OBD2 scanning with any Bluetooth adapter, Find Help Nearby, more vehicles, and more Aura. Pro ($4.99/mo) unlocks everything, including the live telemetry dashboard. See the <a href="/plan">Plans page</a> for the full comparison.',
        },
        {
          q: 'What is the difference between monthly and annual billing?',
          a: 'Annual billing gives you two months free — you pay for ten months and get twelve. You can switch between monthly and annual on the Plans page.',
        },
        {
          q: 'How do I cancel my subscription?',
          a: 'Go to My Plan (in your account menu) and choose "Cancel plan". You will keep your paid features until the end of your current billing period, then move to the Free plan. You can resume anytime before then.',
        },
        {
          q: 'Will I get a refund if I cancel?',
          a: 'We offer a 30-day money-back guarantee on plans. After that, canceling stops future charges but does not refund the current period — you keep access until it ends.',
        },
        {
          q: 'Where can I see my billing history?',
          a: 'My Plan shows every charge and order, including receipts and the status of any hardware orders.',
        },
      ],
    },
    {
      title: 'AuraLink Adapter',
      icon: 'bluetooth',
      items: [
        {
          q: 'What is the AuraLink Adapter?',
          a: 'It is our proprietary Bluetooth OBD2 adapter. Plug it into your car’s OBD2 port and it streams live telemetry — speed, RPM, coolant temp, and more — to the live dashboard in real time.',
        },
        {
          q: 'Do I need the adapter to use AuraLink?',
          a: 'No. Everything except the live streaming dashboard works without it. On Plus you can also scan your car with any standard Bluetooth OBD2 adapter. The AuraLink Adapter is what powers the real-time dashboard experience.',
        },
        {
          q: 'Is there a discount if I buy it with Pro?',
          a: 'Yes — the adapter is discounted when bought together with a Pro plan as a bundle. You can add it during checkout, or grab the bundle directly from the <a href="/plan">Plans page</a>.',
        },
      ],
    },
    {
      title: 'Aura (AI assistant)',
      icon: 'auto_awesome',
      items: [
        {
          q: 'What can Aura help with?',
          a: 'Aura explains fault codes, helps diagnose symptoms ("my car shakes when braking"), tells you whether something is a DIY fix or a mechanic visit, and flags anything safety-critical. When you have vehicles saved, Aura tailors its answers to your specific car and its history.',
        },
        {
          q: 'Is Aura always right?',
          a: 'No — Aura is a helpful starting point, not a certified mechanic. Always confirm safety-critical repairs (brakes, steering, airbags) with a professional before relying on them.',
        },
        {
          q: 'Why is there a daily message limit?',
          a: 'Free and Plus plans include a set number of Aura messages per day to keep the service sustainable. Pro includes unlimited messages. Your remaining messages are shown on the My Plan page.',
        },
        {
          q: 'Is voice support coming?',
          a: 'It’s on our roadmap — a hands-free voice mode designed for in-car and dashboard use.',
        },
      ],
    },
    {
      title: 'Privacy & security',
      icon: 'shield',
      items: [
        {
          q: 'Is my vehicle data private?',
          a: 'Your saved vehicles, issue history, and account data are tied to your account and protected. We don’t sell your personal data.',
        },
        {
          q: 'Is checkout secure?',
          a: 'Payments are processed over an encrypted, PCI-compliant checkout. AuraLink never stores your full card number.',
        },
      ],
    },
    {
      title: 'Troubleshooting',
      icon: 'build',
      items: [
        {
          q: 'A code I entered wasn’t found. What now?',
          a: 'Some manufacturer-specific codes aren’t in our database yet. Double-check the code (they look like one letter followed by four numbers, e.g. P0301). If it’s still not found, ask Aura — it can often explain codes we don’t have a full entry for.',
        },
        {
          q: 'The live dashboard shows demo data. Why?',
          a: 'The dashboard currently shows simulated telemetry as a preview. Real-time data requires the AuraLink Adapter (coming soon) and a Pro plan.',
        },
        {
          q: 'I still need help.',
          a: 'Reach out and we’ll get you sorted. You can also ask Aura for guidance on most vehicle questions.',
        },
      ],
    },
  ];

  // Filtered view: sections whose items match the query (case-insensitive over
  // question + answer). Empty query shows everything.
  readonly filtered = computed<FaqSection[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.sections;
    return this.sections
      .map(s => ({
        ...s,
        items: s.items.filter(i => (i.q + ' ' + i.a).toLowerCase().includes(q)),
      }))
      .filter(s => s.items.length > 0);
  });

  readonly noResults = computed(() => this.filtered().length === 0);

  toggle(key: string): void {
    this.openKeys.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isOpen(key: string): boolean {
    return this.openKeys().has(key);
  }
}
