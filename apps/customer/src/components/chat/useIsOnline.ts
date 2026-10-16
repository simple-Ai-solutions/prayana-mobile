import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useChatStore } from './useChatStore';

/**
 * Whether the phone is online. Starts true; "unknown" (isInternetReachable
 * null, as on a fresh launch) counts as online so the chat never shows an
 * offline banner it can't back up. Also tells the chat store, so messages
 * written offline wait and go on reconnect.
 */
export default function useIsOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const next = state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(next);
      useChatStore.getState().setOnline(next);
    });
    return unsubscribe;
  }, []);
  return online;
}
