import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Legacy path — /(tabs)/home is the Me tab now.
 *
 * Sign-in, index and the offline screen still resolve this route, so it stays
 * as a redirect rather than a second copy of the dashboard.
 */
export default function HomeAlias() {
  return <Redirect href="/(tabs)/me" />;
}
