// Things to do in a city — /global-experiences/<country>/<city> (web parity).
// An optional ?state= lets the API widen city → state before the country.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlaceExperiences } from '../../../components/experiences/PlaceExperiences';

export default function GlobalCityScreen() {
  const { country, city, state } = useLocalSearchParams<{ country: string; city: string; state?: string }>();
  return (
    <PlaceExperiences
      key={`${country}/${city}`}
      country={country}
      city={city}
      state={typeof state === 'string' ? state : undefined}
    />
  );
}
