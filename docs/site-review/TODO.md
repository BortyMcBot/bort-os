# Site Review — https://bryanduckworth.com

Generated: 2026-03-24T15:01:15.509Z

## Summary

The site appears to have a strong technical base and a distinctive, personality-heavy presentation that should stand out from generic portfolio templates. The biggest gains now are in making the professional story clearer at first glance, ensuring foundational SEO and accessibility are not overshadowed by interactivity, and keeping the homepage performant despite several rich client-side features.

## Ready to PR

| ID | Category | Title | Effort |
|---|---|---|---|
| SITE-001 | ux | Hero value proposition may be less clear than the feature set | small |
| SITE-003 | seo | Metadata strategy is not visible in the provided files | small |

## All Findings

| ID | Category | Confidence | Effort | PR Ready | Title |
|---|---|---|---|---|---|
| SITE-001 | ux | high | small | ✅ | Hero value proposition may be less clear than the feature set |
| SITE-002 | content | high | medium | — | Projects may be underemphasized relative to ambient widgets |
| SITE-003 | seo | high | small | ✅ | Metadata strategy is not visible in the provided files |
| SITE-004 | seo | medium | medium | — | Resume PDF should not be the main career summary surface |
| SITE-005 | a11y | medium | medium | — | Motion-heavy interface likely needs stronger reduced-motion support |
| SITE-006 | a11y | high | small | — | Hover-card based content may be weak on touch and keyboard |
| SITE-007 | perf | high | medium | — | Homepage JavaScript cost is likely high for a personal site |
| SITE-008 | perf | high | medium | — | Non-essential widgets should likely be deferred |
| SITE-009 | feature | medium | small | — | Contact path is not clearly represented in the summary |
| SITE-010 | content | medium | small | — | AI chat widget may compete with Bryan’s own voice |
| SITE-011 | perf | medium | small | — | Dual analytics may add unnecessary overhead |
| SITE-012 | feature | medium | medium | — | About-style narrative section may be too implicit |

## Details

### SITE-001: Hero value proposition may be less clear than the feature set

- **Category:** ux
- **Confidence:** high
- **Effort:** small
- **PR Ready:** Yes

The feature list emphasizes interactive elements like a marquee ticker, globe, clocks, AI chat, and micro-posts, but it does not indicate a clear above-the-fold statement of who Bryan is, what he does, and what kind of opportunities he wants. For a personal site, the first screen should communicate identity and value before asking visitors to explore decorative or novelty features.

**Suggested change:** Update src/app/page.tsx to add a prominent headline and 1-2 sentence subheadline above the fold that clearly state Bryan’s role, focus areas, and what visitors should look at next.

### SITE-002: Projects may be underemphasized relative to ambient widgets

- **Category:** content
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

The README highlights multiple experiential sections, but it does not explicitly mention a dedicated projects or case-study section. That creates a risk that visitors remember the globe and chat widget more than actual shipped work. A strong portfolio should foreground projects, outcomes, and technical depth ahead of supporting visual flourishes.

### SITE-003: Metadata strategy is not visible in the provided files

- **Category:** seo
- **Confidence:** high
- **Effort:** small
- **PR Ready:** Yes

The provided key files do not show any explicit Next.js metadata export, page title template, meta description, Open Graph tags, or Twitter card setup. Without this, search snippets and social previews may undersell the site even if the content is good. Personal sites benefit significantly from tailored metadata that states name, specialty, and purpose clearly.

**Suggested change:** Add a metadata export in src/app/layout.tsx with a specific title, description, openGraph, and twitter configuration for bryanduckworth.com.

### SITE-004: Resume PDF should not be the main career summary surface

- **Category:** seo
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

A public PDF resume is useful, but it should not carry the main SEO burden for career information. Search engines and recruiters get more value from HTML sections with semantic headings, role summaries, and achievement-oriented copy. If experience is mostly embedded in a timeline or PDF, the site may miss search and comprehension opportunities.

### SITE-005: Motion-heavy interface likely needs stronger reduced-motion support

- **Category:** a11y
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

The described experience includes a scrolling ticker, interactive globe, live clocks, hover cards, and framer-motion. Those patterns commonly create accessibility issues around vestibular sensitivity, focus management, and noisy live updates for assistive technologies. Even without a live a11y audit, this interaction profile suggests above-average accessibility risk.

### SITE-006: Hover-card based content may be weak on touch and keyboard

- **Category:** a11y
- **Confidence:** high
- **Effort:** small
- **PR Ready:** No

If important tech stack details are primarily exposed through hover cards, mobile users and keyboard users may miss them or have a worse experience. Hover-first patterns are fine as an enhancement, but important explanatory content should remain available through focus, tap, or visible default text. Otherwise the information hierarchy becomes device-dependent.

### SITE-007: Homepage JavaScript cost is likely high for a personal site

- **Category:** perf
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

The dependency stack includes framer-motion, react-globe.gl, react-sizeme, PostHog, Vercel Analytics, and an AI chat widget on top of Next.js and multiple UI packages. That is a lot of client-side capability for a homepage and can easily turn into slow hydration or a heavier-than-necessary initial load, especially on mobile devices. Performance discipline matters more on personal sites because visitors often bounce quickly.

### SITE-008: Non-essential widgets should likely be deferred

- **Category:** perf
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

Features like GitHub contribution counts, world clocks, the globe, analytics, and AI chat are valuable but not essential for first paint. If they mount immediately, they may slow down the initial user journey and reduce responsiveness before visitors even understand Bryan’s value. These should probably be progressively enhanced or lazy-loaded after the core content is visible.

### SITE-009: Contact path is not clearly represented in the summary

- **Category:** feature
- **Confidence:** medium
- **Effort:** small
- **PR Ready:** No

The provided summary mentions many polished sections but does not clearly call out a dedicated contact section, inquiry CTA, or clear next step for recruiters or collaborators. A memorable portfolio still needs a strong conversion path. Without one, the site may impress visitors without giving them an obvious way to act.

### SITE-010: AI chat widget may compete with Bryan’s own voice

- **Category:** content
- **Confidence:** medium
- **Effort:** small
- **PR Ready:** No

ChillChat is distinctive, but on a personal site it can easily become the gimmick people remember instead of the person. If the chat appears too early or too prominently, it may distract from Bryan’s actual story, work, and credibility. The assistant should reinforce the brand, not become the brand.

### SITE-011: Dual analytics may add unnecessary overhead

- **Category:** perf
- **Confidence:** medium
- **Effort:** small
- **PR Ready:** No

The stack includes both PostHog and Vercel Analytics. That may be intentional, but for a personal portfolio it can also mean extra scripts, duplicate event collection, and more client-side overhead than needed. If the two systems are not serving clearly different purposes, consolidation could be a simple performance win.

### SITE-012: About-style narrative section may be too implicit

- **Category:** feature
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

The site summary suggests work history, current focus, and interactive sections, but it does not clearly indicate a dedicated About section that ties together background, interests, values, and professional direction. Personal sites feel stronger when there is one coherent narrative section that makes the person legible, not just the interface. Without it, the site can feel component-rich but story-light.
