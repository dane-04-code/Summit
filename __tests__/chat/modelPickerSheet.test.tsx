import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ModelPickerSheet, shortModelName } from '@/ui/chat/ModelPickerSheet';
import { vendorFor } from '@/ui/chat/providerMarks';
import type { ModelPicker } from '@/ui/chat/useModelPicker';

function picker(overrides: Partial<ModelPicker> = {}): ModelPicker {
  return {
    available: true,
    open: true,
    loading: false,
    error: null,
    scope: 'session',
    catalogue: {
      currentModel: 'claude-sonnet-5',
      currentProvider: 'anthropic',
      providers: [
        { slug: 'openai', name: 'OpenAI', isCurrent: false, models: ['gpt-5.2'] },
        {
          slug: 'anthropic',
          name: 'Anthropic',
          isCurrent: true,
          models: ['claude-opus-5', 'claude-sonnet-5'],
        },
      ],
    },
    currentModel: 'claude-sonnet-5',
    currentProvider: 'anthropic',
    pending: null,
    notice: null,
    openPicker: jest.fn(),
    closePicker: jest.fn(),
    chooseScope: jest.fn(),
    chooseModel: jest.fn(),
    dismissNotice: jest.fn(),
    ...overrides,
  };
}

describe('shortModelName', () => {
  it('drops the vendor path the provider row already shows', () => {
    expect(shortModelName('anthropic/claude-opus-5')).toBe('claude-opus-5');
    expect(shortModelName('gpt-5.2')).toBe('gpt-5.2');
  });
});

describe('vendorFor', () => {
  it('resolves the alias spellings Hermes reports', () => {
    expect(vendorFor('x-ai')).toBe('xai');
    expect(vendorFor('xai-oauth')).toBe('xai');
    expect(vendorFor('claude-code')).toBe('anthropic');
    expect(vendorFor('google-vertex')).toBe('google');
    expect(vendorFor('kimi-cn')).toBe('moonshot');
  });

  it('leaves a self-hosted endpoint unbranded', () => {
    expect(vendorFor('my-home-server')).toBeNull();
    expect(vendorFor('')).toBeNull();
  });
});

describe('ModelPickerSheet', () => {
  it('lists every model the host offered, grouped by provider', async () => {
    const { getByText } = await render(<ModelPickerSheet picker={picker()} />);

    expect(getByText('Anthropic')).toBeTruthy();
    expect(getByText('OpenAI')).toBeTruthy();
    expect(getByText('claude-opus-5')).toBeTruthy();
    expect(getByText('gpt-5.2')).toBeTruthy();
  });

  it('reports a tap as a provider-qualified choice', async () => {
    const state = picker();
    const { getByText } = await render(<ModelPickerSheet picker={state} />);

    fireEvent.press(getByText('gpt-5.2'));

    expect(state.chooseModel).toHaveBeenCalledWith('openai', 'gpt-5.2');
  });

  it('does not re-select the model already running', async () => {
    const state = picker();
    const { getByText } = await render(<ModelPickerSheet picker={state} />);

    fireEvent.press(getByText('claude-sonnet-5'));

    expect(state.chooseModel).not.toHaveBeenCalled();
  });

  it('refuses a second choice while one is still switching', async () => {
    const state = picker({ pending: 'claude-opus-5' });
    const { getByText } = await render(<ModelPickerSheet picker={state} />);

    fireEvent.press(getByText('gpt-5.2'));

    expect(state.chooseModel).not.toHaveBeenCalled();
  });

  it('shows the host error rather than a silent empty sheet', async () => {
    const state = picker({ error: 'Agent disconnected.', catalogue: null });
    const { getByText } = await render(<ModelPickerSheet picker={state} />);

    expect(getByText('Agent disconnected.')).toBeTruthy();
  });

  it('says so when the host has nothing to switch to', async () => {
    const state = picker({
      catalogue: { currentModel: 'x', currentProvider: 'y', providers: [] },
    });
    const { getByText } = await render(<ModelPickerSheet picker={state} />);

    expect(getByText(/no switchable providers/i)).toBeTruthy();
  });

  it('asks again when the scope changes', async () => {
    const state = picker();
    const { getByLabelText } = await render(<ModelPickerSheet picker={state} />);

    fireEvent.press(getByLabelText(/^Default —/));

    expect(state.chooseScope).toHaveBeenCalledWith('default');
  });
});
