import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor, cleanup } from '@testing-library/react-native';

import { RichMarkdown } from '@/ui/chat/richMarkdown';
import { AgentMessage } from '@/ui/chat/AgentMessage';
import { ALL_FIXTURES, WIDE_TABLE, MIXED_DOC } from './fixtures/markdown';

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
  it('uses quiet typing dots without a Working label', async () => {
    const view = await render(
      <AgentMessage blocks={[{ kind: 'markdown', source: '' }]} />,
    );
    expect(view.getByLabelText('Agent is replying')).toBeTruthy();
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
