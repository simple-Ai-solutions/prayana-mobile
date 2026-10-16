// /packages/type/<type> — "Honeymoon Packages", "Family Packages". Mirrors the
// web's app/packages/type/[type]/page.js.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PackageLanding } from '../../../components/packages/PackageLanding';

export default function TypePackagesScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  return <PackageLanding type={String(type || '').toLowerCase()} />;
}
