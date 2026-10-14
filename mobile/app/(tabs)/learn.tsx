import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Legacy path — /(tabs)/learn is the hidden Roadmap route now, reached from
 * Career. Kept as a redirect for deep links and the offline screen.
 */
export default function LearnAlias() {
  return <Redirect href="/(tabs)/roadmap" />;
}
