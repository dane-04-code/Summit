import React from 'react';
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
