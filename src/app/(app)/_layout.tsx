import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';

/** Forces the Connect screen when no agent is configured yet. */
function AgentGuard() {
  const { ready, activeAgent } = useAgents();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onConnect = segments[segments.length - 1] === 'connect';
    if (!activeAgent && !onConnect) {
      router.replace('/(app)/connect');
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
        <Stack.Screen name="connect" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="cron" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
