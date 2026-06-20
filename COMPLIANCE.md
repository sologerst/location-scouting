# Compliance notes

The research that scoped this project found that **legal/compliance is the dominant
risk, not technical feasibility.** Owner-of-record data is public record; phone/email
enrichment + outreach is where the obligations live. Read this before enabling the
contact-enrichment provider or any outreach features.

> This is engineering guidance, not legal advice. Have counsel review before launch.

## The two data tiers (reflected in the UI)

- **Verified (teal)** — Miami-Dade County Property Appraiser. Owner name + mailing
  address are public record under Florida public-records law. Safe to display.
- **Enriched (amber)** — third-party skip-trace (phone/email). Probabilistic,
  vendor-sourced, and legally loaded. Always labeled, confidence-scored, and gated.

## Constraints to honor

1. **FCRA** — The moment enriched data is used for an *eligibility decision*
   (tenant screening, lending, employment, insurance) it may become a "consumer
   report." Keep the product to real-estate outreach / B2B. State the permitted use
   explicitly and gate signup on agreeing to it.
2. **TCPA + DNC** — Calling/texting enriched numbers triggers Do-Not-Call scrub and
   consent rules. Scrub every number against the National DNC Registry (and state
   lists) before presenting it as callable. `ContactDatum.dnc` carries this flag and
   the UI disables "Call" when a number is on the DNC list. The *Jance v. Homerun
   Offer* "buy-intent isn't telemarketing" ruling is a single non-binding district
   court case — do not rely on it to skip DNC/consent.
3. **DPPA** — If any enrichment data derives from DMV records, separate federal
   restrictions attach. Confirm vendor data provenance.
4. **Vendor ToS** — Every skip-trace vendor restricts use to lawful B2B purposes. A
   consumer-facing "enter any address, get anyone's contact" flow may violate those
   terms. Review each vendor's contract before enabling it in `SKIPTRACE_PROVIDER`.

## Before flipping enrichment on (`SKIPTRACE_PROVIDER` ≠ mock)

- [ ] Vendor contract reviewed; our use case is permitted in writing.
- [ ] DNC scrub integrated and wired into `ContactDatum.dnc`.
- [ ] FCRA permitted-use gate + disclaimer shown at signup.
- [ ] Audit log of who looked up what (search_history) retained.
- [ ] Counsel sign-off.
