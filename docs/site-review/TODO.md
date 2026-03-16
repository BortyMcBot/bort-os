# Site Review — https://bryanduckworth.com

Generated: 2026-03-15T15:01:02.628Z

## Summary

The site is visually distinctive and technically modern, with strong personality and a memorable interaction style that already sets it apart from template portfolios. SEO and metadata fundamentals have improved, but the largest remaining gains are in recruiter-facing narrative clarity, conversion-focused structure, and selective performance/accessibility hardening. Overall, this is a high-quality personal site that needs a few strategic content and UX additions to maximize hiring impact.

## Ready to PR

| ID | Category | Title | Effort |
|---|---|---|---|
| SITE-004 | seo | Open Graph asset likely not fully branded for CTR | small |

## All Findings

| ID | Category | Confidence | Effort | PR Ready | Title |
|---|---|---|---|---|---|
| SITE-001 | content | high | small | — | Hero lacks explicit value proposition |
| SITE-002 | feature | high | medium | — | Case studies section is still missing |
| SITE-003 | content | high | medium | — | Employment entries under-emphasize quantified outcomes |
| SITE-004 | seo | high | small | ✅ | Open Graph asset likely not fully branded for CTR |
| SITE-005 | a11y | medium | small | — | No skip-to-content link for keyboard users |
| SITE-006 | ux | medium | medium | — | Section discoverability is linear and scroll-heavy |
| SITE-007 | perf | medium | medium | — | Animation concurrency may impact mobile smoothness |
| SITE-008 | perf | medium | medium | — | Globe component likely has high runtime cost |
| SITE-009 | feature | high | medium | — | Contact path is present but not conversion-optimized |
| SITE-010 | seo | medium | small | — | Sitemap should scale with upcoming public sections |

## Details

### SITE-001: Hero lacks explicit value proposition

- **Category:** content
- **Confidence:** high
- **Effort:** small
- **PR Ready:** No

The top-of-page experience is strong visually but does not immediately communicate target role, specialization, and business impact in one concise statement. Recruiters often decide relevance within seconds, so this slows qualification.

### SITE-002: Case studies section is still missing

- **Category:** feature
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

The site has timeline and stack context but still lacks a dedicated project proof section showing problem, constraints, implementation decisions, and measurable outcomes. This is a key expectation for senior engineering portfolios.

### SITE-003: Employment entries under-emphasize quantified outcomes

- **Category:** content
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

Work history appears present, but impact metrics (e.g., performance gains, reliability improvements, conversion/revenue effects, delivery scope) are not consistently foregrounded. This reduces persuasive power during hiring review.

### SITE-004: Open Graph asset likely not fully branded for CTR

- **Category:** seo
- **Confidence:** high
- **Effort:** small
- **PR Ready:** Yes

Social preview support exists, but the OG image should be optimized as a purpose-built branded card with strong legibility and role framing to improve share click-through and identity recognition.

**Suggested change:** Replace /tmp/site-review/repo/public/og.jpg with a polished 1200x630 branded social card (name + role + concise value line) while keeping metadata references unchanged in /tmp/site-review/repo/src/app/layout.tsx.

### SITE-005: No skip-to-content link for keyboard users

- **Category:** a11y
- **Confidence:** medium
- **Effort:** small
- **PR Ready:** No

A long, section-dense homepage benefits from a visible skip link so keyboard and assistive-tech users can jump directly to main content without tabbing through repeated top controls.

### SITE-006: Section discoverability is linear and scroll-heavy

- **Category:** ux
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

Important sections (resume, projects, contact) are discoverable mainly through full-page scrolling. A compact in-page section index or sticky jump navigation would improve scanning behavior.

### SITE-007: Animation concurrency may impact mobile smoothness

- **Category:** perf
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

Multiple decorative motion layers and interactive components can increase compositing work, particularly on lower-end devices. Reducing simultaneous effects would improve responsiveness and battery usage.

### SITE-008: Globe component likely has high runtime cost

- **Category:** perf
- **Confidence:** medium
- **Effort:** medium
- **PR Ready:** No

The globe is visually compelling but can carry significant client-side weight relative to informational value. Lazy-loading on interaction or lightweight fallback rendering could improve performance.

### SITE-009: Contact path is present but not conversion-optimized

- **Category:** feature
- **Confidence:** high
- **Effort:** medium
- **PR Ready:** No

Contact options exist, but there is no explicit conversion-oriented CTA block with engagement types, availability, and expected response window, which can reduce quality inbound opportunities.

### SITE-010: Sitemap should scale with upcoming public sections

- **Category:** seo
- **Confidence:** medium
- **Effort:** small
- **PR Ready:** No

Current sitemap strategy appears minimal and may not automatically include future public routes (projects/case studies/posts). Expanding coverage is important for crawl efficiency as content grows.
