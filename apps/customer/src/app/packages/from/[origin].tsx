// /packages/from/<city> — "Tour Packages from Delhi". Mirrors the web's
// app/packages/from/[origin]/page.js.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PackageLanding } from '../../../components/packages/PackageLanding';

export default function OriginPackagesScreen() {
  const { origin } = useLocalSearchParams<{ origin: string }>();
  return <PackageLanding origin={String(origin || '').toLowerCase()} />;
}
