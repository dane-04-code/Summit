import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';

function AgentGuard() {
  const { ready, activeAgent } = useAgents();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const last = segments[segments.length - 1] as string;
    const onOnboarding = last === 'connect' || last === 'pair';
    if (!activeAgent && !onOnboarding) {
      router.replace('/(app)/pair' as '/');  // typed route added on next expo start
    }
  }, [ready, activeAgent, segments]);

  return null;
}

export default function AppLayout() {
  return (
    <>
      <AgentGuard />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="pair" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="connection" options={{ headerShown: false }} />
        <Stack.Screen name="data" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="cron" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
