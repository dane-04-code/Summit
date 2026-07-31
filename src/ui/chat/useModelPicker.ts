/**
 * State for the composer's model control.
 *
 * Nothing here knows what a model is. The host owns the catalogue and the
 * switch; this hook only decides when to ask, what to show while waiting, and
 * how to report an answer. The control stays hidden entirely unless the
 * connected agent advertised the capability, so an older connector — which
 * would reject the frame — is never asked.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AgentAdapter, ModelCatalogue, ModelScope } from '@/agents/adapters/types';

export type ModelPickerState = {
  /** The connected agent advertised a picker. False hides the control. */
  available: boolean;
  open: boolean;
  loading: boolean;
  error: string | null;
  scope: ModelScope;
  catalogue: ModelCatalogue | null;
  /** Known only once a catalogue has loaded or a switch has landed. */
  currentModel: string | null;
  /** The provider serving `currentModel`, for its mark. */
  currentProvider: string | null;
  /** The model id being switched to, while the host works. */
  pending: string | null;
  /** The host's own words about the last switch. */
  notice: string | null;
};

export type ModelPicker = ModelPickerState & {
  openPicker: () => void;
  closePicker: () => void;
  chooseScope: (scope: ModelScope) => void;
  chooseModel: (provider: string, model: string) => void;
  dismissNotice: () => void;
};

const INITIAL: ModelPickerState = {
  available: false,
  open: false,
  loading: false,
  error: null,
  scope: 'session',
  catalogue: null,
  currentModel: null,
  currentProvider: null,
  pending: null,
  notice: null,
};

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Could not reach the agent.';
}

export function useModelPicker(
  adapter: AgentAdapter | null,
  getSessionId: () => Promise<string>,
  connectionState: string,
): ModelPicker {
  const [state, setState] = useState<ModelPickerState>(INITIAL);
  // Only the newest request may write results; scope changes and reopens
  // otherwise race, and a stale catalogue would offer a stale scope.
  const requestRef = useRef(0);
  // Latest-ref, so `load` and `chooseModel` stay stable while still resolving
  // the session id the screen would use right now.
  const sessionRef = useRef(getSessionId);
  useEffect(() => {
    sessionRef.current = getSessionId;
  }, [getSessionId]);

  // Renegotiated on every (re)connect: upgrading the plugin should reveal the
  // control without re-pairing, and losing the peer should retire it.
  useEffect(() => {
    const available = adapter?.supportsModelPicker?.() ?? false;
    setState((prev) => (prev.available === available ? prev : { ...prev, available }));
  }, [adapter, connectionState]);

  const load = useCallback(
    async (scope: ModelScope) => {
      if (!adapter?.listModels) return;
      const request = ++requestRef.current;
      setState((prev) => ({ ...prev, loading: true, error: null, scope }));
      try {
        const sessionId = await sessionRef.current();
        const catalogue = await adapter.listModels(sessionId, scope);
        if (requestRef.current !== request) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          catalogue,
          currentModel: catalogue.currentModel || prev.currentModel,
          currentProvider: catalogue.currentProvider || prev.currentProvider,
        }));
      } catch (error) {
        if (requestRef.current !== request) return;
        setState((prev) => ({ ...prev, loading: false, error: messageFor(error) }));
      }
    },
    [adapter],
  );

  const openPicker = useCallback(() => {
    setState((prev) => ({ ...prev, open: true, notice: null }));
    void load(INITIAL.scope);
  }, [load]);

  const closePicker = useCallback(() => {
    // Abandon anything in flight so a late answer can't reopen the sheet.
    requestRef.current++;
    setState((prev) => ({ ...prev, open: false, loading: false, pending: null, error: null }));
  }, []);

  const chooseScope = useCallback(
    (scope: ModelScope) => {
      // The host fixes persistence when it opens the picker, so a different
      // scope means a genuinely different request — not a local flag.
      setState((prev) => (prev.scope === scope ? prev : { ...prev, catalogue: null }));
      void load(scope);
    },
    [load],
  );

  const chooseModel = useCallback(
    (provider: string, model: string) => {
      if (!adapter?.selectModel) return;
      const request = ++requestRef.current;
      setState((prev) => ({ ...prev, pending: model, error: null }));
      void (async () => {
        try {
          const sessionId = await sessionRef.current();
          const notice = await adapter.selectModel!(sessionId, provider, model);
          if (requestRef.current !== request) return;
          setState((prev) => ({
            ...prev,
            open: false,
            pending: null,
            currentModel: model,
            currentProvider: provider,
            notice,
          }));
        } catch (error) {
          if (requestRef.current !== request) return;
          // The sheet stays open: the user is still on the old model and the
          // list they were choosing from is still the right one.
          setState((prev) => ({ ...prev, pending: null, error: messageFor(error) }));
        }
      })();
    },
    [adapter],
  );

  const dismissNotice = useCallback(() => {
    setState((prev) => (prev.notice === null ? prev : { ...prev, notice: null }));
  }, []);

  return { ...state, openPicker, closePicker, chooseScope, chooseModel, dismissNotice };
}
