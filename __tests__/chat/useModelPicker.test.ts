/**
 * The picker's own decisions: when to ask, what to keep, and what never to
 * claim. The adapter is a stub — nothing here depends on a real host.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useModelPicker } from '@/ui/chat/useModelPicker';
import type { AgentAdapter, ModelCatalogue } from '@/agents/adapters/types';

const CATALOGUE: ModelCatalogue = {
  currentModel: 'claude-sonnet-5',
  currentProvider: 'anthropic',
  providers: [
    { slug: 'anthropic', name: 'Anthropic', isCurrent: true, models: ['claude-opus-5'] },
  ],
};

function stubAdapter(overrides: Partial<AgentAdapter> = {}): AgentAdapter {
  return {
    framework: 'hermes',
    supportsModelPicker: () => true,
    listModels: jest.fn(async () => CATALOGUE),
    selectModel: jest.fn(async () => 'Model switched to `claude-opus-5`'),
    ...overrides,
  } as unknown as AgentAdapter;
}

const getSessionId = async () => 'session-1';

function mount(adapter: AgentAdapter | null) {
  return renderHook(() => useModelPicker(adapter, getSessionId, 'connected'));
}

it('stays hidden for an agent that never advertised a picker', async () => {
  const { result } = await mount(stubAdapter({ supportsModelPicker: () => false }));

  await waitFor(() => expect(result.current.available).toBe(false));
});

it('shows for an agent that advertised one', async () => {
  const { result } = await mount(stubAdapter());

  await waitFor(() => expect(result.current.available).toBe(true));
});

it('loads the catalogue on open and remembers the current model', async () => {
  const adapter = stubAdapter();
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });

  await waitFor(() => expect(result.current.catalogue).toEqual(CATALOGUE));
  expect(adapter.listModels).toHaveBeenCalledWith('session-1', 'session');
  expect(result.current.currentModel).toBe('claude-sonnet-5');
  expect(result.current.currentProvider).toBe('anthropic');
});

it('re-asks the host when the scope changes, because the host fixes it', async () => {
  const adapter = stubAdapter();
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });
  await waitFor(() => expect(result.current.catalogue).not.toBeNull());

  await act(async () => {
    result.current.chooseScope('default');
  });

  await waitFor(() => expect(result.current.scope).toBe('default'));
  expect(adapter.listModels).toHaveBeenLastCalledWith('session-1', 'default');
});

it('surfaces a load failure instead of an empty list', async () => {
  const adapter = stubAdapter({
    listModels: jest.fn(async () => {
      throw new Error('Agent disconnected.');
    }),
  });
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });

  await waitFor(() => expect(result.current.error).toBe('Agent disconnected.'));
  expect(result.current.loading).toBe(false);
});

it('moves the current model only after the host confirms the switch', async () => {
  const adapter = stubAdapter();
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });
  await waitFor(() => expect(result.current.catalogue).not.toBeNull());

  await act(async () => {
    result.current.chooseModel('anthropic', 'claude-opus-5');
  });

  await waitFor(() => expect(result.current.currentModel).toBe('claude-opus-5'));
  expect(result.current.open).toBe(false);
  expect(result.current.notice).toContain('claude-opus-5');
});

it('keeps the old model and the open sheet when a switch fails', async () => {
  const adapter = stubAdapter({
    selectModel: jest.fn(async () => {
      throw new Error('Error: staying on claude-sonnet-5.');
    }),
  });
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });
  await waitFor(() => expect(result.current.catalogue).not.toBeNull());

  await act(async () => {
    result.current.chooseModel('anthropic', 'claude-opus-5');
  });

  await waitFor(() => expect(result.current.error).toContain('staying on claude-sonnet-5'));
  expect(result.current.currentModel).toBe('claude-sonnet-5');
  expect(result.current.open).toBe(true);
  expect(result.current.pending).toBeNull();
});

it('drops a catalogue that arrives after the sheet was closed', async () => {
  let release: ((value: ModelCatalogue) => void) | null = null;
  const adapter = stubAdapter({
    listModels: jest.fn(
      () => new Promise<ModelCatalogue>((resolve) => { release = resolve; }),
    ),
  });
  const { result } = await mount(adapter);

  await act(async () => {
    result.current.openPicker();
  });
  await waitFor(() => expect(release).not.toBeNull());

  await act(async () => {
    result.current.closePicker();
  });
  await act(async () => {
    release!(CATALOGUE);
  });

  expect(result.current.open).toBe(false);
  expect(result.current.catalogue).toBeNull();
});
