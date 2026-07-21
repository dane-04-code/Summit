import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { EventDisclosure } from '@/ui/chat/EventDisclosure';

describe('EventDisclosure', () => {
  it('keeps operational details collapsed until the user asks for them', async () => {
    const onOpen = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <EventDisclosure
        receipt={{
          sessionId: 'summit-scheduled-0123456789abcdef01234567',
          createdAt: Date.UTC(2026, 6, 21, 14, 32),
          scheduledWork: true,
        }}
        onOpen={onOpen}
        onDismiss={onDismiss}
      />,
    );

    expect(view.getByText('Scheduled work finished')).toBeTruthy();
    expect(view.queryByText('Open conversation')).toBeNull();

    await fireEvent.press(view.getByLabelText('Show Scheduled work finished'));
    await waitFor(() => expect(view.getByText('Delivered to Scheduled work')).toBeTruthy());

    await fireEvent.press(view.getByText('Open conversation'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
