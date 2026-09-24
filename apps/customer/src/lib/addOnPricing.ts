// addOnPricing — turning an optional extra's list price into a charge.
//
// Ported from the web's utils/addOnPricing.js. The unit is the whole
// difficulty: a honeymoon set-up is sold to a room, not to each occupant, so
// billing it per head would charge a couple twice for one decorated room.
//
// Four places have to arrive at the same number — the web detail sidebar, the
// web checkout summary, this app, and the server breakdown that actually
// charges it (server/services/packagePricingCalculator.js). Keep them in step.

export type AddOnPriceUnit = 'per_person' | 'per_couple' | 'per_booking';

export type PackageAddOn = {
  _id?: string;
  name: string;
  description?: string | null;
  price: number;
  priceUnit?: AddOnPriceUnit;
  includes?: string[];
  imageUrl?: string | null;
  isActive?: boolean;
};

/** How many units of an add-on a party of `pax` buys. */
export function addOnUnits(priceUnit: string | undefined, pax: number): number {
  const heads = Math.max(1, Number(pax) || 1);
  switch (priceUnit) {
    // Rounds UP: five travellers occupy three rooms, and the one in the third
    // room still gets the set-up. Rounding down would hand it over free.
    case 'per_couple':
      return Math.ceil(heads / 2);
    case 'per_booking':
      return 1;
    default:
      return heads;
  }
}

export function addOnCharge(addOn: PackageAddOn | null | undefined, pax: number): number {
  return Math.round((Number(addOn?.price) || 0) * addOnUnits(addOn?.priceUnit, pax));
}

export function addOnsTotal(addOns: PackageAddOn[] | null | undefined, pax: number): number {
  return (addOns || []).reduce((sum, a) => sum + addOnCharge(a, pax), 0);
}

export function addOnUnitLabel(priceUnit?: string): string {
  if (priceUnit === 'per_couple') return ' / couple';
  if (priceUnit === 'per_booking') return ' / booking';
  return ' / person';
}

/**
 * Only an extra with an _id can be re-priced server-side. One without it stays
 * an informational card rather than offering a toggle checkout would silently
 * drop — the same rule the web applies.
 */
export function isSelectableAddOn(a: PackageAddOn): boolean {
  return Boolean(a?._id) && a?.isActive !== false;
}

export function activeAddOns(addOns: PackageAddOn[] | null | undefined): PackageAddOn[] {
  return (addOns || []).filter((a) => a?.isActive !== false);
}
