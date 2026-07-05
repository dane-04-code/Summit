import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AgentProvider } from '@/agents/AgentProvider';
import { AnalyticsProvider } from '@/lib/analytics';
import { initNotificationHandling } from '@/notifications/push';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { installGlobalErrorHandlers, setErrorUser } from '@/lib/errorReporting';

function RouteGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Attribute error reports to the signed-in user (null on sign-out).
  useEffect(() => {
    setErrorUser(session?.user?.id ?? null);
  }, [session]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome' as '/'); // typed route added on next expo start
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    installGlobalErrorHandlers();
    initNotificationHandling();
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
