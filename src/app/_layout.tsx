import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AgentProvider } from '@/agents/AgentProvider';
import { AnalyticsProvider } from '@/lib/analytics';

function RouteGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <AnalyticsProvider>
      <AuthProvider>
        <AgentProvider>
          <RouteGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AgentProvider>
      </AuthProvider>
    </AnalyticsProvider>
  );
}
