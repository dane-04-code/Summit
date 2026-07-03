import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor, cleanup } from '@testing-library/react-native';

import { RichMarkdown } from '@/ui/chat/richMarkdown';
import { ALL_FIXTURES, WIDE_TABLE, MIXED_DOC } from './fixtures/markdown';

afterEach(cleanup);

describe('RichMarkdown renders fixtures without crashing', () => {
  for (const [name, source] of Object.entries(ALL_FIXTURES)) {
    it(`renders ${name}`, async () => {
      render(<RichMarkdown source={source} />);
      await waitFor(() => expect(screen.toJSON()).not.toBeNull());
    });
  }
});

describe('wide table overflow', () => {
  it('wraps a wide table in a horizontal scroll container so columns are reachable', async () => {
    render(<RichMarkdown source={WIDE_TABLE} />);
    const scroller = await waitFor(() => screen.getByTestId('md-table-scroll'));
    expect(scroller.props.horizontal).toBe(true);
  });

  it('scrolls the table inside a mixed document too', async () => {
    render(<RichMarkdown source={MIXED_DOC} />);
    const scroller = await waitFor(() => screen.getByTestId('md-table-scroll'));
    expect(scroller.props.horizontal).toBe(true);
  });
});

describe('type ramp', () => {
  it('renders ## as a real 20px heading, not an uppercase label', async () => {
    render(<RichMarkdown source={'## Section title'} />);
    const el = await waitFor(() => screen.getByText('Section title'));
    const style = StyleSheet.flatten(el.props.style);
    expect(style.fontSize).toBe(20);
    expect(style.textTransform).toBeUndefined();
  });

  it('renders body text at 17px to match the thread', async () => {
    render(<RichMarkdown source={'Plain paragraph.'} />);
    const el = await waitFor(() => screen.getByText('Plain paragraph.'));
    expect(StyleSheet.flatten(el.props.style).fontSize).toBe(17);
  });
});
