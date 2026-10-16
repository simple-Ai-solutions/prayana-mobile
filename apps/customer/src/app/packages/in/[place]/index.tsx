// /packages/in/<place> — "Manali Tour Packages", "Rajasthan Tour Packages".
// Mirrors the web's app/packages/in/[place]/page.js.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PackageLanding } from '../../../../components/packages/PackageLanding';

export default function PlacePackagesScreen() {
  const { place } = useLocalSearchParams<{ place: string }>();
  return <PackageLanding place={String(place || '').toLowerCase()} />;
}
