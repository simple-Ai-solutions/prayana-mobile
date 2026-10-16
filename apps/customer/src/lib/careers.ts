// Careers data — ported from the web's app/careers/page.jsx OPENINGS. The
// `slug` is stored on JobApplication.roleSlug, so never rename a live slug or
// existing applications orphan off their listing in /admin/careers.
import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export interface CareerRole {
  slug: string;
  title: string;
  team?: string;
  type?: string;
  location?: string;
  schedule?: string;
  duration?: string;
  compensation?: string;
  compensationNote?: string;
  gradient?: [string, string];
  icon?: IconName;
  blurb?: string;
  responsibilities?: string[];
  requirements?: string[];
  niceToHave?: string[];
  openings?: number;
  screeningQuestion?: string;
  productQuestion?: string;
  isOpenApplication?: boolean;
}

export const OPENINGS: CareerRole[] = [
  {
    slug: 'bd-intern-b2b',
    title: 'Business Development Intern',
    team: 'Partnerships',
    type: 'Internship',
    location: 'Remote — anywhere in India',
    schedule: 'Mon–Fri, 10am–6pm',
    duration: '3–6 months',
    compensation: '₹150 per business onboarded',
    compensationNote:
      'You earn ₹150 for every business you successfully onboard and take live on the platform. Uncapped — the more you sign, the more you earn. Paid monthly.',
    gradient: ['#14b8a6', '#0891b2'],
    icon: 'briefcase',
    blurb:
      "Find travel businesses, pitch them, and get them live on the Prayana marketplace. You'll own the partner funnel end to end, from first cold call to go-live.",
    responsibilities: [
      'Research and identify travel businesses — activity operators, tour providers, transport and rental vendors, turf and venue owners, homestays',
      'Cold outreach via calls, email, and WhatsApp to pitch the Prayana partner program',
      'Run intro and demo calls explaining how vendors list and earn on our platform',
      'Own onboarding end to end: KYC docs, listing setup, pricing, photos, go-live',
      'Maintain the partner pipeline — follow-ups, status, conversion tracking',
      'Feed vendor objections and feature requests back to the product team',
    ],
    requirements: [
      'Available full-time, Mon–Fri, 10am–6pm — best suited to recent graduates, gap-year candidates, or final-semester students without class commitments',
      'Strong spoken and written communication in English, plus Hindi and/or Kannada',
      'Comfortable with cold calling — you\'re not scared of a "no"',
      'Organised and self-driven; this role is 70% persistence and follow-up',
      "You must have your own laptop and smartphone — we don't provide hardware",
      'Reliable internet connection at your work location',
      'Basic comfort with Google Sheets or CRM tools',
      'Minimum 3-month commitment',
    ],
    niceToHave: [
      'Prior BD, sales, or campus-ambassador experience',
      'Existing contacts in travel or hospitality',
      'Regional language skills for South or North India markets',
    ],
    openings: 10,
    screeningQuestion:
      'In 3 lines: why would you be good at convincing a business owner to try something new?',
    productQuestion:
      'Sign up on Prayana and plan a trip. What was confusing, and what would you tell a vendor is the single best reason to list with us?',
  },
  {
    slug: 'influencer-marketing-intern',
    title: 'Influencer Marketing Intern',
    team: 'Growth',
    type: 'Internship',
    location: 'Remote — anywhere in India',
    schedule: 'Flexible hours',
    duration: '3–6 months',
    compensation: '5% commission on bookings you drive',
    compensationNote:
      'You earn 5% of the booking value of every trip, activity, or package booked through the creators and campaigns you bring in. Uncapped. Paid monthly on settled bookings.',
    gradient: ['#8b5cf6', '#9333ea'],
    icon: 'megaphone',
    blurb:
      "Bring travel creators onto Prayana and turn their audiences into bookings. You'll find the right creators, pitch the collaboration, and own the campaign from brief to payout.",
    responsibilities: [
      'Identify travel creators on Instagram, YouTube, and X whose audience actually books trips',
      'Pitch Prayana collaborations over DM, email, and calls — and negotiate the terms',
      'Set creators up with tracked links and promo codes so every booking is attributed to you',
      'Brief creators on what to feature: itineraries, activities, eSIM, holiday packages',
      'Track campaign performance — reach, clicks, bookings, revenue per creator',
      'Build a repeatable creator pipeline instead of one-off posts',
      "Feed back what's converting so the growth team can double down",
    ],
    requirements: [
      "You genuinely follow creator and travel content — you know who's real and who's buying followers",
      'Confident cold-pitching creators over DM and email without sounding like a template',
      'Comfortable reading basic numbers: reach, CTR, conversions',
      'Self-driven — this role is unsupervised and outcome-based',
      "You must have your own laptop and smartphone — we don't provide hardware",
      'Reliable internet connection at your work location',
      'Minimum 3-month commitment',
    ],
    niceToHave: [
      'You already create content or run a page with real engagement',
      'Existing relationships with travel or lifestyle creators',
      'Experience with affiliate links, UTM tracking, or campaign dashboards',
      'Video editing or basic design skills',
    ],
    openings: 50,
    screeningQuestion:
      "Name one travel creator you'd pitch Prayana to, and tell us in 3 lines exactly how you'd open that conversation.",
    productQuestion:
      'Sign up on Prayana and plan a trip. Which feature would you lead with in a creator collab, and why would their audience care?',
  },
];

export const OPEN_APPLICATION: CareerRole = {
  slug: 'open-application',
  title: 'Open Application',
  isOpenApplication: true,
  screeningQuestion: 'What would you want to work on at Prayana, and why you?',
};

// Headline count is people-hired, not roles-listed.
export const TOTAL_OPENINGS = OPENINGS.reduce((sum, r) => sum + (r.openings || 1), 0);

export function findRole(slug?: string | null): CareerRole | undefined {
  if (!slug) return undefined;
  if (slug === OPEN_APPLICATION.slug) return OPEN_APPLICATION;
  return OPENINGS.find((r) => r.slug === slug);
}

export const PERKS: Array<{ icon: IconName; title: string; desc: string; gradient: [string, string] }> = [
  { icon: 'laptop-outline', title: 'Fully remote', desc: 'Work from anywhere in India. We care about what you ship, not where you sit.', gradient: ['#14b8a6', '#0891b2'] },
  { icon: 'people-outline', title: 'Founder mentorship', desc: "You'll work directly with the founding team — no layers, no gatekeeping.", gradient: ['#8b5cf6', '#9333ea'] },
  { icon: 'trending-up', title: 'Uncapped upside', desc: 'Performance-linked earnings. The better you do, the more you make — no ceiling.', gradient: ['#f59e0b', '#ea580c'] },
  { icon: 'ribbon-outline', title: 'Certificate + LOR', desc: 'Completion certificate and a letter of recommendation for strong performers.', gradient: ['#f43f5e', '#db2777'] },
  { icon: 'rocket-outline', title: 'Real ownership', desc: "The businesses you sign go live in days. You'll see your own work in the product.", gradient: ['#10b981', '#0d9488'] },
  { icon: 'school-outline', title: 'PPO for top performers', desc: "Do well and there's a full-time offer waiting at the end of the internship.", gradient: ['#3b82f6', '#4f46e5'] },
];

export const PROCESS: Array<{ step: string; title: string; desc: string; icon: IconName }> = [
  { step: '01', title: 'Apply', desc: 'Fill the form. Takes 5 minutes.', icon: 'send-outline' },
  { step: '02', title: 'Intro call', desc: 'A 20-minute call with the founding team.', icon: 'chatbubble-ellipses-outline' },
  { step: '03', title: 'Live exercise', desc: 'A short, practical task — no take-home marathons.', icon: 'locate-outline' },
  { step: '04', title: 'Offer', desc: 'We move fast. Expect a decision within a week.', icon: 'sparkles-outline' },
];

export type ApplicationStatus =
  | 'new'
  | 'reviewing'
  | 'shortlisted'
  | 'interviewing'
  | 'offered'
  | 'hired'
  | 'rejected';

export const STATUS_STYLE: Record<ApplicationStatus, { label: string; fg: string; bg: string; bgDark: string }> = {
  new: { label: 'New', fg: '#475569', bg: '#f1f5f9', bgDark: 'rgba(148,163,184,0.16)' },
  reviewing: { label: 'Reviewing', fg: '#2563eb', bg: '#eff6ff', bgDark: 'rgba(59,130,246,0.16)' },
  shortlisted: { label: 'Shortlisted', fg: '#4f46e5', bg: '#eef2ff', bgDark: 'rgba(99,102,241,0.18)' },
  interviewing: { label: 'Interviewing', fg: '#d97706', bg: '#fffbeb', bgDark: 'rgba(245,158,11,0.16)' },
  offered: { label: 'Offered', fg: '#059669', bg: '#ecfdf5', bgDark: 'rgba(16,185,129,0.16)' },
  hired: { label: 'Hired', fg: '#047857', bg: '#d1fae5', bgDark: 'rgba(16,185,129,0.24)' },
  rejected: { label: 'Not selected', fg: '#e11d48', bg: '#fff1f2', bgDark: 'rgba(244,63,94,0.16)' },
};

export interface JobApplication {
  _id: string;
  roleSlug?: string;
  roleTitle?: string;
  status?: ApplicationStatus;
  createdAt?: string;
  fullName?: string;
  phone?: string;
  location?: string;
  experience?: string;
  availableFrom?: string;
  hasResume?: boolean;
  resume?: { filename?: string };
}
