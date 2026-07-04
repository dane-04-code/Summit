/**
 * The root error boundary is the difference between a stranger seeing a dead
 * white screen and seeing a calm "something went wrong, try again". It must
 * also report the crash — a render failure is exactly the kind of thing we're
 * otherwise blind to.
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockCaptureError = jest.fn();
jest.mock('@/lib/errorReporting', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

import { ErrorBoundary } from '@/ui/ErrorBoundary';

/** Throws on first render, then behaves once `boom` is flipped off. */
function Bomb({ boom }: { boom: boolean }) {
  if (boom) throw new Error('render exploded');
  return <Text>recovered child</Text>;
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockCaptureError.mockReset();
    // React prints caught render errors to console.error; expected here.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('renders its children when nothing throws', async () => {
    render(
      <ErrorBoundary>
        <Text>healthy child</Text>
      </ErrorBoundary>,
    );
    await waitFor(() => expect(screen.getByText('healthy child')).toBeTruthy());
  });

  it('shows a recovery fallback and reports the error when a child throws', async () => {
    render(
      <ErrorBoundary>
        <Bomb boom />
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy());
    expect(screen.getByText(/try again/i)).toBeTruthy();
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockCaptureError.mock.calls[0][1]).toMatchObject({ where: 'render', fatal: true });
  });

  it('recovers to children after Try again when the underlying issue is gone', async () => {
    render(
      <ErrorBoundary>
        <Bomb boom />
      </ErrorBoundary>,
    );

    await waitFor(() => expect(screen.getByText(/try again/i)).toBeTruthy());

    // The next render will no longer throw.
    screen.rerender(
      <ErrorBoundary>
        <Bomb boom={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText(/try again/i));

    await waitFor(() => expect(screen.getByText('recovered child')).toBeTruthy());
  });
});
