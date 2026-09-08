// legalDocs.js — mobile mirror of the server legal registry
// (server/lib/legal/registry.js). The booking APIs require an acceptedLegalDocs[]
// payload of { slug, version } matching each doc's currentVersion, or the server
// rejects the booking with 400 "Required legal acceptances are missing".
//
// Keep these versions in sync with server/lib/legal/registry.js. When a doc
// version bumps server-side, bump it here too (a mismatch => "stale" rejection).

// Every legal doc + its current version, keyed by slug.
export const LEGAL_DOCS = {
  'platform-tou': { slug: 'platform-tou', version: '1.0.0', title: 'Terms of Use' },
  'booking-tnc': { slug: 'booking-tnc', version: '1.0.0', title: 'Booking Terms & Conditions' },
  'privacy-policy': { slug: 'privacy-policy', version: '2.0.0', title: 'Privacy Policy' },
  'cancellation-refund': { slug: 'cancellation-refund', version: '1.0.0', title: 'Cancellation & Refund Policy' },
  'package-booking-tnc': { slug: 'package-booking-tnc', version: '1.0.0', title: 'Holiday Package Terms' },
  'self-drive-rental': { slug: 'self-drive-rental', version: '1.0.0', title: 'Self-Drive Rental Agreement' },
  'chauffeur-transport': { slug: 'chauffeur-transport', version: '1.0.0', title: 'Chauffeur Transport Terms' },
  'activity-waiver': { slug: 'activity-waiver', version: '1.0.0', title: 'Activity Waiver' },
};

// context → required doc slugs (mirror of registry.requiredFor).
const REQUIRED_BY_CONTEXT = {
  'booking:package': ['platform-tou', 'booking-tnc', 'privacy-policy', 'cancellation-refund', 'package-booking-tnc'],
  'booking:activity': ['platform-tou', 'booking-tnc', 'privacy-policy', 'cancellation-refund'],
  'booking:transport_self_drive': ['platform-tou', 'booking-tnc', 'privacy-policy', 'cancellation-refund', 'self-drive-rental'],
  'booking:transport_chauffeur': ['platform-tou', 'booking-tnc', 'privacy-policy', 'cancellation-refund', 'chauffeur-transport'],
};

// The docs a given booking context requires: [{ slug, version, title }].
export function requiredLegalDocs(context) {
  const slugs = REQUIRED_BY_CONTEXT[context] || [];
  return slugs.map((s) => LEGAL_DOCS[s]).filter(Boolean);
}

// The acceptedLegalDocs[] payload to POST once the user has ticked "I agree":
// [{ slug, version }] (server stamps ip/ua/timestamp).
export function buildAcceptedLegalDocs(context) {
  return requiredLegalDocs(context).map((d) => ({ slug: d.slug, version: d.version }));
}
