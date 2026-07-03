// Redirect: flat /place/[name] → /destination/[location]/[place]
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PlaceRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; location: string }>();
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const location = Array.isArray(params.location) ? params.location[0] : params.location;

  useEffect(() => {
    if (name) {
      const loc = location || name;
      router.replace({
        pathname: '/destination/[location]/[place]',
        params: { location: loc, place: name },
      } as any);
    } else {
      router.back();
    }
  }, [name, location, router]);

  return null;
}
