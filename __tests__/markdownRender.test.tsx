import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react-native';

import { RichMarkdown } from '@/ui/chat/richMarkdown';
import { AgentMessage } from '@/ui/chat/AgentMessage';
import { ApprovalCard } from '@/ui/chat/ApprovalCard';
import { ALL_FIXTURES, WIDE_CODE, WIDE_TABLE, MIXED_DOC } from './fixtures/markdown';

afterEach(cleanup);

describe('RichMarkdown renders fixtures without crashing', () => {
  for (const [name, source] of Object.entries(ALL_FIXTURES)) {
    it(`renders ${name}`, async () => {
      const { toJSON } = await render(<RichMarkdown source={source} />);
      await waitFor(() => expect(toJSON()).not.toBeNull());
    });
  }
});

describe('wide table overflow', () => {
  it('wraps a wide table in a horizontal scroll container so columns are reachable', async () => {
    const view = await render(<RichMarkdown source={WIDE_TABLE} />);
    const scroller = await waitFor(() => view.getByTestId('md-table-scroll'));
    expect(scroller.props.horizontal).toBe(true);
  });

  it('scrolls the table inside a mixed document too', async () => {
    const view = await render(<RichMarkdown source={MIXED_DOC} />);
    const scroller = await waitFor(() => view.getByTestId('md-table-scroll'));
    expect(scroller.props.horizontal).toBe(true);
  });
});

describe('command overflow', () => {
  it('constrains fenced Markdown code to a horizontally scrollable viewport', async () => {
    const view = await render(<RichMarkdown source={WIDE_CODE} />);
    const scroller = await waitFor(() => view.getByTestId('code-block-scroll'));
    expect(scroller.props.horizontal).toBe(true);
    expect(StyleSheet.flatten(scroller.props.style).flex).toBe(1);
  });

  it('makes a structured approval command horizontally scrollable', async () => {
    const view = await render(
      <ApprovalCard
        title="Run this command?"
        command="docker compose run --rm worker ./scripts/a-very-long-command --with-many-flags"
        onApprove={jest.fn()}
        onStop={jest.fn()}
      />,
    );
    expect(view.getByTestId('command-snippet-scroll').props.horizontal).toBe(true);
  });
});

describe('type ramp', () => {
  it('renders ## as a real 20px heading, not an uppercase label', async () => {
    const view = await render(<RichMarkdown source={'## Section title'} />);
    const el = await waitFor(() => view.getByText('Section title'));
    const style = StyleSheet.flatten(el.props.style);
    expect(style.fontSize).toBe(20);
    expect(style.textTransform).toBeUndefined();
  });

  it('renders body text at 17px to match the thread', async () => {
    const view = await render(<RichMarkdown source={'Plain paragraph.'} />);
    const el = await waitFor(() => view.getByText('Plain paragraph.'));
    expect(StyleSheet.flatten(el.props.style).fontSize).toBe(17);
  });
});

describe('empty streaming reply', () => {
  it('immediately tells the user the agent is thinking', async () => {
    const view = await render(
      <AgentMessage blocks={[{ kind: 'markdown', source: '' }]} />,
    );
    expect(view.getByLabelText('Agent status: Thinking…')).toBeTruthy();
    expect(view.getByText('Thinking…')).toBeTruthy();
    expect(view.queryByText('Working')).toBeNull();
  });

  it('shows structured activity without a message bubble', async () => {
    const view = await render(
      <AgentMessage blocks={[{ kind: 'activity', label: 'Searching the web…' }]} />,
    );
    expect(view.getByText('Searching the web…')).toBeTruthy();
    expect(view.queryByText('Working')).toBeNull();
  });
});

describe('Hermes approval fallback', () => {
  const prompt = [
    'Dangerous command requires approval:',
    '',
    '`rm -rf build-cache`',
    '',
    'Choose one:',
    '- `/approve`',
    '- `/approve session`',
    '- `/approve always`',
    '- `/deny`',
  ].join('\n');

  it('renders the slash-command fallback as a clean action grid', async () => {
    const onApprovalCommand = jest.fn();
    const view = await render(
      <AgentMessage
        blocks={[{ kind: 'markdown', source: prompt }]}
        onApprovalCommand={onApprovalCommand}
      />,
    );

    expect(view.getByLabelText('Approval needed')).toBeTruthy();
    expect(view.getByText('Approve once')).toBeTruthy();
    expect(view.getByText('This session')).toBeTruthy();
    expect(view.getByText('Always allow')).toBeTruthy();
    expect(view.getByText('Deny')).toBeTruthy();
    expect(view.queryByText('/approve session')).toBeNull();
    expect(view.getByTestId('command-snippet-scroll').props.horizontal).toBe(true);
    expect(view.getByText('rm -rf build-cache')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Approve once. This command'));
    expect(onApprovalCommand).toHaveBeenCalledWith('/approve');
  });

  it('keeps a persisted decision resolved after the thread reloads', async () => {
    const view = await render(
      <AgentMessage
        blocks={[{ kind: 'markdown', source: prompt }]}
        onApprovalCommand={jest.fn()}
        resolvedApprovalCommand="/approve session"
      />,
    );

    expect(view.getByLabelText('Approval decision sent')).toBeTruthy();
    expect(view.getByText('Decision sent')).toBeTruthy();
    expect(view.getByText('Hermes received “This session”.')).toBeTruthy();
  });
});
