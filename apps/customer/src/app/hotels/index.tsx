// /hotels — used to be a "hotels coming soon" waitlist. Hotels, homestays,
// hostels, resorts and villas are bookable now under /stays, so this route
// only forwards there. Kept (rather than deleted) so old links and pushes
// still land somewhere useful: a `city` (or `q`) becomes the stays search.
import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function HotelsRedirect() {
  const { city, q } = useLocalSearchParams<{ city?: string; q?: string }>();
  const place = String(q || city || '').trim().slice(0, 80);
  return <Redirect href={(place ? `/stays?q=${encodeURIComponent(place)}` : '/stays') as any} />;
}
