// /trip/invite/<token> — accept an emailed collaboration invite. Mirrors the
// web's app/trip/invite/[token]/page.js: POST /api/invites/:token/accept.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TripJoinScreen } from '../../../components/trip/TripJoinScreen';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <TripJoinScreen mode="invite" token={String(token || '')} />;
}
