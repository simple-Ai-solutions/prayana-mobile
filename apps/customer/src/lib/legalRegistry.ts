// Legal document registry — COPIED VERBATIM from the web's
// lib/legal/registry.js, which is itself mirrored server-side. The server
// rejects a booking whose acceptedLegalDocs do not cover this set at these
// versions, so keep the three copies in sync.

// Single source of truth for legal document versions and where each is required.
// Mirrored server-side at travelai/server/lib/legal/registry.js — keep in sync.
//
// `requiredFor` keys:
//   signup                          — accepted at account creation
//   booking:activity                — accepted at activity checkout
//   booking:activity_waiver         — accepted only when the listing's
//                                     ActivityTypeConfig.safetyConfig.requiresWaiver === true
//   booking:package                 — accepted at holiday-package checkout
//   booking:package_overseas        — additionally surfaces TCS disclosure
//   booking:transport_self_drive    — accepted at self-drive transport checkout
//   booking:transport_chauffeur     — accepted at chauffeur transport checkout
//   vendor_onboarding:activity      — vendor lists activities
//   vendor_onboarding:package       — vendor lists holiday packages
//   vendor_onboarding:transport_self_drive — vendor lists self-drive vehicles
//   vendor_onboarding:transport_chauffeur  — vendor lists chauffeur-driven service

export const LEGAL_DOCS = {
  "platform-tou": {
    slug: "platform-tou",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Platform Terms of Use",
    requiredFor: [
      "signup",
      "booking:activity",
      "booking:package",
      "booking:transport_self_drive",
      "booking:transport_chauffeur",
      "vendor_onboarding:activity",
      "vendor_onboarding:package",
      "vendor_onboarding:transport_self_drive",
      "vendor_onboarding:transport_chauffeur",
    ],
  },
  "booking-tnc": {
    slug: "booking-tnc",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Booking Terms",
    requiredFor: [
      "booking:activity",
      "booking:package",
      "booking:transport_self_drive",
      "booking:transport_chauffeur",
    ],
  },
  "privacy-policy": {
    slug: "privacy-policy",
    currentVersion: "2.0.0",
    versionTag: "v2",
    effectiveDate: "2026-05-28",
    title: "Privacy Policy",
    requiredFor: [
      "signup",
      "booking:activity",
      "booking:package",
      "booking:transport_self_drive",
      "booking:transport_chauffeur",
    ],
  },
  "cancellation-refund": {
    slug: "cancellation-refund",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Cancellation & Refund Policy",
    requiredFor: [
      "booking:activity",
      "booking:package",
      "booking:transport_self_drive",
      "booking:transport_chauffeur",
    ],
  },
  "grievance-redressal": {
    slug: "grievance-redressal",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Grievance Redressal Policy",
    requiredFor: [], // informational, linked from other docs
  },
  "cookie-policy": {
    slug: "cookie-policy",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Cookie Policy",
    requiredFor: [], // consent collected separately via banner
  },
  "vendor-agreement": {
    slug: "vendor-agreement",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Vendor / Supplier Agreement",
    requiredFor: [
      "vendor_onboarding:activity",
      "vendor_onboarding:package",
      "vendor_onboarding:transport_self_drive",
      "vendor_onboarding:transport_chauffeur",
    ],
  },
  "activity-waiver": {
    slug: "activity-waiver",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Activity Participant Waiver",
    // TODO(counsel): adventure waivers in India are enforceable only for
    // ordinary negligence; do not gate adventure SKUs on this checkbox until
    // Sections 4-6 of the waiver are rewritten by tort/insurance counsel.
    requiredFor: ["booking:activity_waiver"],
  },
  "package-booking-tnc": {
    slug: "package-booking-tnc",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Holiday Package Booking Terms",
    // TODO(counsel + CA): TCS §206C(1G) collection is personal-officer
    // liability under §206C(7); do not enable booking:package_overseas
    // until CA reviews the collection flow.
    requiredFor: ["booking:package"],
  },
  "self-drive-rental": {
    slug: "self-drive-rental",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Self-Drive Rental Agreement",
    // TODO(counsel): per-state Rent-a-Cab Scheme 1989 / MV Aggregator
    // Guideline 2020 licensing must be confirmed before activating
    // self-drive in any new state.
    requiredFor: ["booking:transport_self_drive"],
  },
  "chauffeur-transport": {
    slug: "chauffeur-transport",
    currentVersion: "1.0.0",
    versionTag: "v1",
    effectiveDate: "2026-05-28",
    title: "Chauffeur Transport Terms",
    requiredFor: ["booking:transport_chauffeur"],
  },
};

// Compute the doc set required for a given context (e.g. "booking:activity").
// Pass extra context flags via `flags` (e.g. { waiverRequired: true, overseas: true }).
export interface RequiredLegalDoc {
  slug: string;
  version: string;
  title: string;
  href: string;
  isWaiver?: boolean;
}

export interface AcceptedLegalDoc {
  slug: string;
  version: string;
}

type LegalFlags = { waiverRequired?: boolean; overseas?: boolean };

export function requiredDocsFor(context: string, flags: LegalFlags = {}): RequiredLegalDoc[] {
  const docs: RequiredLegalDoc[] = [];
  for (const doc of Object.values(LEGAL_DOCS)) {
    if ((doc.requiredFor as readonly string[]).includes(context)) {
      docs.push({
        slug: doc.slug,
        version: doc.currentVersion,
        title: doc.title,
        href: `/legal/${doc.slug}-${doc.versionTag}`,
      });
    }
  }
  if (context === "booking:activity" && flags.waiverRequired) {
    const waiver = LEGAL_DOCS["activity-waiver"];
    docs.push({
      slug: waiver.slug,
      version: waiver.currentVersion,
      title: waiver.title,
      href: `/legal/${waiver.slug}-${waiver.versionTag}`,
      isWaiver: true,
    });
  }
  if (context === "booking:package" && flags.overseas) {
    // TCS disclosure rendered by the UI; no extra doc beyond package-booking-tnc.
  }
  return docs;
}

// Validate that a submitted acceptedLegalDocs[] array covers the required set
// at the current versions. Returns { ok, missing[], stale[] }.
export function validateAcceptance(submitted: AcceptedLegalDoc[] | null | undefined, context: string, flags: LegalFlags = {}) {
  const required = requiredDocsFor(context, flags);
  const submittedMap = new Map((submitted || []).map((d) => [d.slug, d.version]));
  const missing: string[] = [];
  const stale: Array<{ slug: string; submittedVersion?: string; currentVersion: string }> = [];
  for (const req of required) {
    if (!submittedMap.has(req.slug)) {
      missing.push(req.slug);
    } else if (submittedMap.get(req.slug) !== req.version) {
      stale.push({ slug: req.slug, submittedVersion: submittedMap.get(req.slug), currentVersion: req.version });
    }
  }
  return { ok: missing.length === 0 && stale.length === 0, missing, stale, required };
}
