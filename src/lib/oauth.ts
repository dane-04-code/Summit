import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Must run once at module scope so a returning OAuth redirect resolves the
// pending browser session instead of leaving it hanging (Android in particular).
// No-op on web — there's no native browser session to complete.
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Pre-warms the in-app browser so the OAuth redirect opens without a visible
// cold-start flash. warmUpAsync/coolDownAsync are native-only (no Chrome Custom
// Tab / SFSafariViewController concept on web).
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
