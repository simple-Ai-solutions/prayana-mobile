// Things to do in a country — /global-experiences/<country> (web parity).
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlaceExperiences } from '../../../components/experiences/PlaceExperiences';

export default function GlobalCountryScreen() {
  const { country } = useLocalSearchParams<{ country: string }>();
  return <PlaceExperiences key={String(country)} country={country} />;
}
