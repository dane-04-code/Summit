import { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ClerkProvider } from '@clerk/clerk-expo';
import { CLERK_PUBLISHABLE_KEY, clerkTokenCache } from '@/lib/clerk';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AgentProvider } from '@/agents/AgentProvider';
import { AnalyticsProvider } from '@/lib/analytics';
import { initNotificationHandling, observeNotificationResponses } from '@/notifications/push';
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

  const openNotification = useCallback(
    ({ sessionId }: { sessionId: string | null }) => {
      // The relay may include the opaque local session ID in a future push.
      // No message content or credentials ever become router parameters.
      router.replace({
        pathname: '/(app)',
        // `n` marks this tap. The chat screen honours a session id once per
        // tap, so a later agent switch doesn't get dragged back here — and a
        // second push for the same thread still routes.
        params: sessionId ? { sessionId, n: String(Date.now()) } : {},
      } as never);
    },
    [router],
  );

  useEffect(() => {
    // Wait for auth before consuming a cold-start response. This ensures a
    // notification cannot bypass the normal signed-in route guard.
    if (loading || !session) return;
    return observeNotificationResponses(openNotification);
  }, [loading, session, openNotification]);

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
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
          <AuthProvider>
            <AgentProvider>
              <RouteGuard />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </AgentProvider>
          </AuthProvider>
        </ClerkProvider>
      </AnalyticsProvider>
    </ErrorBoundary>
  );
}
