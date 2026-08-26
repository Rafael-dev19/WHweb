# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: homeowners in the Guadalajara metro area (ZMG: Guadalajara, Zapopan, Tlaquepaque, Tonalá, El Salto, Tlajomulco) and the rest of Jalisco, remodeling or furnishing a home — kitchen, closet, or bathroom — deciding as a household, mid-to-high ticket, considered purchase.

Secondary (internal): four staff roles operating the business through private panels — `jefe` (owner, full access), `administrador`, `empleado` (production-cleared orders only), `disenador` (SketchUp/VCarve design work). Staff auth is Firebase Auth; role stored in `usuarios_personal.rol`.

## Product Purpose

Wooden House designs and builds custom solid-wood furniture (kitchens, closets, bathroom furniture) for homes in Jalisco, and runs the entire commercial/operational relationship — browsing, quoting, scheduling, purchasing, tracking, production — through its own site instead of ad hoc WhatsApp/social-media handling. Success is a homeowner who can go from "I need a kitchen" to a scheduled, quoted, paid, tracked order without leaving the site (or, for staff, a fully worked order without leaving the panel).

## Positioning

Confirmed differentiator: most local custom-furniture workshops operate purely over WhatsApp/social media with no self-serve online layer. Wooden House's mechanism is the integrated digital platform itself — live catalog with specs/dimensions/pricing, self-serve quote requests and at-home measurement appointments, online purchase with card/PayPal (including MSI financing), and order/quote/appointment tracking from a private customer portal — wrapped around genuine 10+-year artisanal manufacturing. A competitor could copy the craftsmanship claim; the full quote-to-delivery digital thread is the harder-to-copy piece.

## Operating Context

- Customer-facing flow: catálogo → cotización (custom quote) or cita (in-home measurement appointment) → carrito/checkout → pago (Stripe or PayPal, incl. MSI) → seguimiento (order/quote/appointment tracking) → mi-cuenta (portal for history/documents). Guest checkout exists (`invitacion.php`) alongside account-based purchase.
- Staff-facing flow: `panel_administrador.php` (jefe/administrador — full ops: orders, clients, capacity, staff invites) and `panel_empleado.php` (shared by empleado + disenador — narrower, production-stage view). Both push-notify staff (Firebase Cloud Messaging) with an intentionally insistent per-login opt-in until enabled — a standing requirement from the owner that staff stay reachable for new orders/quotes/appointments.
- Delivery/install: no extra charge inside ZMG; extra freight outside ZMG within Jalisco, confirmed with the quote before the customer commits.
- Production timeline: 2–4 weeks typical, communicated per-quote.
- Real production business, live at muebleswh.com, hosted on a self-managed VPS; `.env` in this repo holds live Stripe/PayPal sandbox and production Firebase/Brevo credentials — never fabricate or print its values.

## Capabilities and Constraints

- Materials worked: pine, cedar, oak/encino, MDF, plywood (triplay), melamine.
- Financing: 3/6/9/12-month interest-free installments (MSI) on purchases over $5,000 MXN via participating cards; alternative 50% deposit / 50% on delivery.
- Warranty: 1 year against manufacturing defects, plus a 30-day satisfaction guarantee.
- Auth: customers can sign in with Google or email/password; staff sign in via Firebase Auth only (no local password path).
- Payments: Stripe and PayPal, sandbox keys currently in use.
- Categories live today: cocinas integrales, clósets, muebles de baño (per the seeded catalog and copy); catalog is data-driven (`productos`/`categorias` tables), so other furniture categories can be added without a redesign.

## Brand Commitments

- Name "Wooden House" and existing logo (`public/assets/img/logo-header.png`) are fixed identity, not up for replacement.
- Current palette (café/madera + dorado over dark, with a mirrored light theme) is an established, intentional brand choice — see `variables.css`. Redesign works within/refines this identity rather than replacing it with an unrelated color story.
- Social presence to preserve: Facebook, Instagram, WhatsApp, TikTok (linked from the footer).

## Evidence on Hand

- Real project videos already hosted in Firebase Storage (`proyecto1.mp4`–`proyecto6.mp4`) used as the "Proyectos Realizados" showcase — real work, not placeholder.
- Real FAQ content already authored (delivery times, installation, warranty, financing, materials, quote cost) — preserve as factual content, restyle only.
- Google embed map pinned to the real business location.
- No customer testimonials/reviews on hand today — do not fabricate any.

## Product Principles

1. The digital thread (quote → appointment → purchase → tracking) is the product, not a marketing shell around a workshop — every redesigned page should make that thread easier to start and easier to continue, not just look better.
2. Speak to a homeowner making a considered, mid-to-high-ticket household decision — trustworthy and concrete (real materials, real timelines, real warranty terms), not hype-driven.
3. Staff panels are Operate-mode tools for daily production work, not a scaled-down version of the marketing site — clarity and speed for the four roles outrank marketing polish there.
4. Never fabricate proof (testimonials, reviews, numbers) that isn't already on the site or confirmed by the owner.
5. This is a live business on a live VPS — redesign work must preserve existing functionality, routes, and data contracts (PHP includes, `/api` endpoints, DB schema) while replacing only the visual layer and icon system.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond standard web practice; existing markup already uses ARIA labels/roles in places (nav, modals) — preserve and extend that baseline rather than lowering it.
