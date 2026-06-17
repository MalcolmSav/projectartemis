import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Tracks whether the device currently has a usable internet connection.
 * `online` starts true (optimistic) and flips when connectivity is lost.
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      // reachable === false only when we're confident there's no internet;
      // null/undefined means "unknown" → treat as online to avoid false alarms.
      const reachable = state.isInternetReachable;
      setOnline(state.isConnected !== false && reachable !== false);
    });
    return () => sub();
  }, []);

  return online;
}
