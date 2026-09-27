import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Connectivity state.
 *
 * `isInternetReachable` is the field that actually matters: a device can be
 * joined to Wi-Fi with no route out. It is null until the first probe resolves,
 * so it is treated as "assume online" — blocking the composer during the first
 * moments after launch would be worse than a request that fails and retries.
 *
 * `wasOffline` lets the UI say "you're offline" only after connectivity was
 * genuinely lost, rather than flashing a banner on cold start.
 */
export interface Connectivity {
  isOnline: boolean;
  /** true once this session has been offline and come back */
  wasOffline: boolean;
}

export function useConnectivity(): Connectivity {
  const netInfo = useNetInfo();
  const [wasOffline, setWasOffline] = useState(false);

  const isOnline = netInfo.isInternetReachable ?? netInfo.isConnected ?? true;

  useEffect(() => {
    if (!isOnline) setWasOffline(true);
  }, [isOnline]);

  return { isOnline, wasOffline };
}
