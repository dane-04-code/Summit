import { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Auth0Provider } from 'react-native-auth0';
import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from '@/lib/auth0';
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
        params: sessionId ? { sessionId } : {},
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
        <Auth0Provider domain={AUTH0_DOMAIN || 'configure.auth0.com'} clientId={AUTH0_CLIENT_ID || 'configure'}>
          <AuthProvider>
            <AgentProvider>
              <RouteGuard />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </AgentProvider>
          </AuthProvider>
        </Auth0Provider>
      </AnalyticsProvider>
    </ErrorBoundary>
  );
}
