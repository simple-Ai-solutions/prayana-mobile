// /packages/in/<place>/<facet> — a destination narrowed one way:
// …/from-delhi, …/honeymoon, …/4-days-3-nights. Mirrors the web's
// app/packages/in/[place]/[facet]/page.js.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PackageLanding } from '../../../../components/packages/PackageLanding';

export default function PlaceFacetPackagesScreen() {
  const { place, facet } = useLocalSearchParams<{ place: string; facet: string }>();
  return <PackageLanding place={String(place || '').toLowerCase()} facet={String(facet || '').toLowerCase()} />;
}
