// /trip/share/<shareToken> — join a trip from its share link (the link
// components/trip/InviteSheet.tsx hands out). Mirrors the web's
// app/trip/share/[shareToken]/page.js: GET /api/share/:shareToken/join.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TripJoinScreen } from '../../../components/trip/TripJoinScreen';

export default function ShareTripScreen() {
  const { shareToken } = useLocalSearchParams<{ shareToken: string }>();
  return <TripJoinScreen mode="share" token={String(shareToken || '')} />;
}
