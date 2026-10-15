// The FAQ on a package page, answered from the package — ported from the
// web's lib/packageFaq.js. Every answer is read off this package's own fields,
// and a question is left out when the package does not say: no answer is
// better than a guessed one. Keep in step with the web.

export type FaqItem = { q: string; a: string };

const money = (amount: number, currency = 'INR') => {
  if (!(amount > 0)) return null;
  return currency === 'INR'
    ? `₹${Math.round(amount).toLocaleString('en-IN')}`
    : `${currency} ${amount.toLocaleString('en-IN')}`;
};

const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const uniq = (arr: any[]) => [...new Set(arr.filter(Boolean).map((s) => String(s).trim()).filter(Boolean))];

export function packageFaq(pkg: any): FaqItem[] {
  if (!pkg) return [];
  const faq: FaqItem[] = [];
  const name = pkg.title;

  // Price — the same figure the card leads with.
  const currency = pkg.pricing?.display?.currency || pkg.pricing?.currency || 'INR';
  const price = money(pkg.platformSellingPrice || pkg.pricing?.startingFrom, currency);
  if (price) {
    const variants = (pkg.variants || []).filter((v: any) => v.isActive !== false && v.pricing?.basePrice > 0);
    faq.push({
      q: `How much does the ${name} package cost?`,
      a: `It starts at ${price} per person.`
        + (variants.length > 1
          ? ` The price depends on the option you choose (${list(uniq(variants.map((v: any) => v.displayName || v.name)))}) and the number of travellers.`
          : ''),
    });
  }

  // Length and route.
  const nights = pkg.duration?.nights;
  if (nights > 0) {
    const stops = [...(pkg.destinations || [])]
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((d: any) => (d.nightsHere > 0 ? `${d.city || d.name} (${d.nightsHere}N)` : d.city || d.name));
    faq.push({
      q: 'How many days is this trip?',
      a: `${nights + 1} days and ${nights} nights` + (stops.length ? `, covering ${list(uniq(stops))}.` : '.'),
    });
  }

  // Where it starts — only when the package names it.
  const boarding = uniq((pkg.boardingPoints || []).map((b: any) => b.city));
  const origins = boarding.length ? boarding : uniq(pkg.departureCities || []);
  if (origins.length) {
    faq.push({
      q: 'Where does this trip start?',
      a: boarding.length > 1
        ? `You can join at ${list(boarding)}. Reporting times for each point are on the itinerary.`
        : `It departs from ${list(origins)}.`,
    });
  }

  // Hotels, from the default option, else the itinerary.
  const variant = (pkg.variants || []).find((v: any) => v.isDefault) || pkg.variants?.[0];
  const hotels = uniq([
    ...(variant?.hotels || []).map((h: any) => h.name),
    ...(variant?.hotels?.length ? [] : (pkg.itinerary || []).map((d: any) => d.accommodation?.hotelName)),
  ]);
  if (hotels.length) {
    faq.push({
      q: 'Which hotels are included?',
      // Hotel names carry their own commas, so they are separated with semicolons.
      a: `${hotels.slice(0, 6).join('; ')}${hotels.length > 6 ? `; and ${hotels.length - 6} more` : ''}`
        + (variant?.hotelCategory ? ` (${variant.hotelCategory})` : '') + '.',
    });
  }

  // Meals, counted off the itinerary. Silent when none are recorded.
  const meals: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0 };
  (pkg.itinerary || []).forEach((d: any) => Object.keys(meals).forEach((m) => { if (d.meals?.[m]) meals[m]++; }));
  const mealParts = Object.entries(meals)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${m}${n > 1 ? (m === 'lunch' ? 'es' : 's') : ''}`);
  if (mealParts.length) {
    faq.push({ q: 'Are meals included?', a: `Yes: ${list(mealParts)}, as listed day by day in the itinerary.` });
  }

  // Flights, quoted from the operator's own inclusion or exclusion line.
  const flightLine = (lines: string[]) => (lines || []).find((l) => /\b(flight|airfare|air ticket)s?\b/i.test(l));
  const flightIn = flightLine(pkg.inclusions);
  const flightOut = !flightIn && flightLine(pkg.exclusions);
  if (flightIn || flightOut) {
    faq.push({
      q: 'Are flights included?',
      a: flightIn
        ? `Yes. The package includes: “${flightIn}”.`
        : `No. The operator lists this as not included: “${flightOut}”.`,
    });
  }

  // Cancellation, from the stated rules.
  const rules = [...(pkg.cancellationPolicy?.rules || [])].sort((a: any, b: any) => b.daysBeforeTravel - a.daysBeforeTravel);
  if (rules.length) {
    faq.push({
      q: 'What is the cancellation policy?',
      a: rules.map((r: any, i: number) => (r.refundPercent > 0
        ? `${r.refundPercent}% refund when cancelled ${r.daysBeforeTravel}+ days before travel`
        : i > 0 ? 'no refund after that' : `no refund within ${r.daysBeforeTravel} days of travel`)).join('; ') + '.',
    });
  }

  return faq;
}
