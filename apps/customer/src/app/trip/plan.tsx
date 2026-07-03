// /trip/plan is deprecated. The instant-generate flow was consolidated into the
// canonical "Quick Itinerary" screen (/quick-itinerary) to match the PWA, which
// has a single instant-generate entry. This redirects any old links there.
import { Redirect } from 'expo-router';

export default function PlanTripRedirect() {
  return <Redirect href="/quick-itinerary" />;
}
