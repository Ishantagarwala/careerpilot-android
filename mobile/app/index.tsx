import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { LoadingStateView } from '../src/components/primitives/StateView';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace('/(tabs)/home' as any);
    } else {
      router.replace('/(auth)/welcome' as any);
    }
  }, [isAuthenticated, isLoading, router]);

  return <LoadingStateView message="Restoring session..." />;
}
