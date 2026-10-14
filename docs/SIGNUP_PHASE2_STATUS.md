# Phase 2 — local landing-page build

14 October 2026. Implementation prepared in the website repository on `singup-phase2`. The app repository is also on `singup-phase2`. Committed on `singup-phase2` in both repositories; nothing deployed.

Website source: `E:/TTS/Projects/Websites/TrovoTech_Solutions/products/baylior/`.

Implemented: hero, sticky product navigation, verified features and qualified module labels, approved screenshots, Windows/Android licence explanation, onboarding steps, pricing teaser, FAQ, contact/download fallback and closing actions. Existing Trovo header/footer reused; product styles are scoped to Baylior. E6 omitted. No fixed marketing prices, trial duration, free-signup wording or one-click WhatsApp claim.

Metadata includes intended canonical URL, Open Graph/Twitter share data and SoftwareApplication JSON-LD without prices/offers. New composed share image: `assets/baylior/share-card.png`, exactly 1200×630. Additive local sitemap entry prepared.

Release guards: local-only banner, noindex/nofollow, Apache/LiteSpeed `Require local`, labelled in-page placeholders for all signup/pricing actions, and disabled destination configuration. Phase 5 must deliberately configure and verify integration before release gates are removed.

Verification completed: local reference/anchor integrity, unique IDs, approved screenshot hashes, share-card dimensions, metadata/wording rules, sitemap parsing, JavaScript syntax and isolated destination-policy tests. See website `tools/check-baylior-preview.py` and `tools/check-baylior-links.cjs`.

Browser review completed 14 October 2026 (built-in browser, local server on port 5195):
- Desktop 1440 wide: no console errors, no broken images, no horizontal scroll; the sticky product bar sits under the site header.
- Mobile 375 wide: no horizontal scroll; section links scroll sideways inside the bar; every anchor lands below the sticky bars.
- Keyboard: visible cyan focus outline; FAQ opens with Enter; a Preview link moves focus to the explanation box.
- Share card checked visually (1200×630).

Phase 2 is complete. Small follow-ups (not blocking): the page footer omits the Terms and Refund links the other pages have; on phones the site header plus product bar take about 185px.

Preserved existing website working changes. No Phase 3 global navigation/home changes, Phase 4 signup modifications or hosting changes performed.
