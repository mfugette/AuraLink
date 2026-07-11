---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
license: Complete terms in LICENSE.txt
---

# Frontend Design

> **AuraLink has an established visual system — match it, don't reinvent it.**
> The section immediately below is the source of truth for how this app looks
> *today*. The design-philosophy guidance that follows it applies only when
> creating a genuinely new surface with no precedent, and even then must stay
> inside the system below. When touching existing UI, consistency wins.

## The AuraLink design system (current direction)

The app was deliberately overhauled from a soft, "bubbly" SaaS look to a flat,
utilitarian **instrument-console** aesthetic — think a precise diagnostic
readout, not a rounded consumer dashboard. Everything reads from the `--obd-*`
CSS custom properties in `client/src/styles.scss` (dark + light themes are both
just overrides of those tokens). Never hardcode a color, radius, or shadow that
a token already covers.

**Shape & elevation — flat and square.**
- Corners are near-square: `--obd-radius-sm: 3px` / `--obd-radius: 4px` /
  `--obd-radius-lg: 6px`. `--obd-radius-pill` is `4px` too — there are **no
  pill shapes** anymore. Round is reserved only for things that are physically
  round (a toggle switch knob, a status dot).
- Structure reads from **1px hairline borders** (`--obd-border`,
  `--obd-border-strong`), not from soft drop-shadows. Shadows are minimal and
  used only to lift true overlays (menus, the notification pane) — never as a
  glow. **No gradient fills, no colored glow shadows, no gradient text.**

**Color — flat accent, semantic tones.**
- Accent is a single flat `--obd-blue` (never a blue→indigo gradient).
  `--obd-purple` is the secondary accent (Aura/AI, Pro). Keep the app on
  **blue/purple** — do not introduce a green primary.
- Semantic tones stay separate from the accent: `--obd-green` (ok/account),
  `--obd-yellow`, `--obd-orange`, `--obd-red` (alert). Status chips use a
  `color-mix()` tint + matching hairline border in the tone's color.

**Typography — Inter, sharpened, with a mono "readout" face.**
- Body/UI is Inter, but sharpened globally in `styles.scss`: `'calt' 0` turns
  off the soft contextual alternates and `cv05/cv08/ss01` + `font-optical-sizing`
  give harder, more mechanical glyphs. Headings get `-0.02em` tracking. Keep
  this — do not reintroduce loose, rounded heading type.
- `--obd-font-mono` (system mono stack) is the **instrument-readout** face: use
  it for eyebrows, uppercase labels, section headers, data/metrics, badges,
  timestamps, and counts. Eyebrows/labels are uppercase with wide letter-spacing
  (~0.06–0.16em).
- Buttons and nav labels are uppercase, bold, tracked-out. Primary buttons are
  solid `--obd-blue` (flat, `filter: brightness(1.1)` on hover — not a glow);
  secondary buttons are `--obd-surface-2` with a hairline border.

**Established layout patterns (mirror these when extending the shell):**
- **Sidebar** (`components/sidebar/`): narrow icon rail (collapsed 56px / expanded
  232px). Top "toggle section" holds a `NAVIGATION` mono eyebrow + a bordered
  collapse/expand chevron, then a divider, then the nav list. Active item is a
  **solid filled `--obd-blue` block** with white text. The header logo icon,
  the collapsed-rail icon column, and the expanded nav-icon column all align on
  one vertical axis at x=28px (rail-width/2) — preserve that alignment if you
  change rail width or icon sizes.
- **Notification pane** (`components/notifications/`): a right slide-in modeled on
  a data panel — mono uppercase header + collapse chevron, a bordered search box,
  a `N OF N SHOWN — ALL / UNREAD` mono filter row, compact rows of
  `checkbox │ title + mono category label beneath │ toned status badge + time`
  (one-line titles, no long body summaries), and a bordered bottom action bar.
  On desktop it sits **flush below the top bar** (`top: --obd-header-height`); on
  mobile (≤520px) it goes full-height (`top: 0`).
- **Top-bar icons**: uniform 36px, each a bordered `--obd-surface-2` square
  (`--obd-radius-sm`) — theme toggle, help, notification bell, account trigger.
- **Hero**: flat ground with a faint hairline **grid backdrop** (on a masked
  pseudo-element so the fade-out never dims the content), a mono eyebrow with a
  leading tick mark, sharp heavy title with a flat `--obd-blue` accent span,
  squared mono badges, and flat squared CTA buttons.

**When adding new UI:** reach for the existing tokens and the patterns above
first. A new page should look like it shipped with the sidebar and notification
pane, not like a separate product. Spend novelty on the content/interaction, not
on re-litigating shape, color, or type.

---

## General design philosophy (new surfaces only)

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This client has already rejected proposals that felt templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.

## Ground it in the subject

If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before – use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.

Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.

Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence - like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.

Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects; choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.

Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. Just like a human designer who's hired, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the human's design brief: create a compact token system with color, type, layout, and signature. Color: describe the palette as 4–6 named hex values. Type: the typefaces for 2+ roles (a characterful display face that's used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single unique element this page will be remembered by that embodies the brief in an appropriate way.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan exactly and deriving every color and type decision from it.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and a element-based selector like .cta). This can happen often with paddings/margins between sections.

Try to do a lot of this planning and iteration in your thinking, and only show ideas to the user when you have higher confidence it'll delight them.

## Restraint and self-critique

Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Not taking a risk can be a risk itself! Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected. Critique your own work as you build, taking screenshots if your environment supports it – a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creators have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand, and therefore easier to use. They are design material, not decoration. Bring the same intentionality to copy that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's side of the screen. Name things by what people control and recognize, never by how the system is built. A person manages notifications, not webhook config. Describe what something does in plain terms rather than selling it. Being specific is always better than being clever.

Use active voice as default. A control should say exactly what happens when it's used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the register conversational and tuned: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each element do exactly one job. A label labels, an example demonstrates, and nothing quietly does double duty.