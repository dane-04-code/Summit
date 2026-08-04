import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChatComposer, mergeDictation } from '@/ui/chat/ChatComposer';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    abort: jest.fn(),
    stop: jest.fn(),
    start: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    isRecognitionAvailable: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

const mockSpeech = jest.requireMock('expo-speech-recognition').ExpoSpeechRecognitionModule;

describe('ChatComposer', () => {
  it('merges dictated text without damaging an existing draft', () => {
    expect(mergeDictation('Check the logs', 'before deploying.')).toBe(
      'Check the logs before deploying.',
    );
    expect(mergeDictation('', 'Start fresh')).toBe('Start fresh');
  });

  it('starts private dictation without persisting an audio recording', async () => {
    const view = await render(
      <ChatComposer
        value="Existing draft"
        onChangeText={jest.fn()}
        onSend={jest.fn()}
        onStop={jest.fn()}
        streaming={false}
        bottomInset={0}
      />,
    );

    await fireEvent.press(view.getByLabelText('Dictate message'));

    await waitFor(() => expect(mockSpeech.start).toHaveBeenCalled());
    expect(mockSpeech.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockSpeech.start.mock.calls.at(-1)?.[0]).not.toHaveProperty('recordingOptions');
  });

  it('rests at one line, anchored to the top of its own row', async () => {
    await render(
      <ChatComposer
        value=""
        onChangeText={jest.fn()}
        onSend={jest.fn()}
        onStop={jest.fn()}
        streaming={false}
        bottomInset={0}
      />,
    );

    const input = screen.getByLabelText('Message input');
    const style = StyleSheet.flatten(input.props.style);
    expect(style.height).toBe(28);
    expect(style.padding).toBe(0);
    expect(style.includeFontPadding).toBe(false);
    expect(input.props.textAlignVertical).toBe('top');
  });

  it('keeps the field scrollable at rest so iOS reports a truthful content height', async () => {
    // iOS pins a UITextView's contentSize to its frame while scrolling is off,
    // so a field that disables scrolling below its maximum can never measure
    // its way past one line — the draft wraps into clipped, unreachable space.
    await render(
      <ChatComposer
        value=""
        onChangeText={jest.fn()}
        onSend={jest.fn()}
        onStop={jest.fn()}
        streaming={false}
        bottomInset={0}
      />,
    );

    expect(screen.getByLabelText('Message input').props.scrollEnabled).not.toBe(false);
  });

  it('collapses after a send clears the draft from the parent', async () => {
    const props = {
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
    };
    const view = await render(<ChatComposer {...props} value={'A five line draft'} />);

    await fireEvent(view.getByLabelText('Message input'), 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 200, height: 120 } },
    });
    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByLabelText('Message input').props.style).height).toBe(120);
    });

    // The send path clears `value` from the parent; `onChangeText` never fires.
    await view.rerender(<ChatComposer {...props} value="" />);

    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByLabelText('Message input').props.style).height).toBe(28);
    });
  });

  it('grows from a native content measurement even when it arrives before the text update', async () => {
    const props = {
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
    };
    const view = await render(<ChatComposer {...props} value="" />);
    const input = view.getByLabelText('Message input');

    await fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 200, height: 48 } },
    });
    await view.rerender(<ChatComposer {...props} value={'First line\nSecond line'} />);

    await waitFor(() => {
      const updatedInput = view.getByLabelText('Message input');
      const style = StyleSheet.flatten(updatedInput.props.style);
      expect(style.height).toBe(48);
    });
  });

  it('resets its measurement after a draft is cleared, so the next draft does not jump', async () => {
    const props = {
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
    };
    const view = await render(<ChatComposer {...props} value={'A tall draft'} />);
    const input = view.getByLabelText('Message input');

    await fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 200, height: 96 } },
    });
    await fireEvent.changeText(input, '');
    await view.rerender(<ChatComposer {...props} value="" />);
    await fireEvent.changeText(view.getByLabelText('Message input'), 'New draft');
    await view.rerender(<ChatComposer {...props} value="New draft" />);

    await waitFor(() => {
      const nextInput = view.getByLabelText('Message input');
      expect(StyleSheet.flatten(nextInput.props.style).height).toBe(28);
    });
  });

  it('leaves send unlit until there is a draft to send', async () => {
    const props = {
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
    };
    const view = await render(<ChatComposer {...props} value="   " />);

    const idle = view.getByLabelText('Send message');
    expect(idle.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(idle);
    expect(props.onSend).not.toHaveBeenCalled();

    await view.rerender(<ChatComposer {...props} value="Deploy the branch" />);
    const armed = view.getByLabelText('Send message');
    expect(armed.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(armed);
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('stays armed as a stop control while a reply streams', async () => {
    const onStop = jest.fn();
    const view = await render(
      <ChatComposer
        value=""
        onChangeText={jest.fn()}
        onSend={jest.fn()}
        onStop={onStop}
        streaming
        bottomInset={0}
      />,
    );

    const stop = view.getByLabelText('Stop reply');
    expect(stop.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('offers the command menu from the tray, and reports whether it is open', async () => {
    const onCommands = jest.fn();
    const props = {
      value: '',
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
      onCommands,
    };
    const view = await render(<ChatComposer {...props} commandsOpen={false} />);

    const commands = view.getByLabelText('Commands');
    expect(commands.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(commands);
    expect(onCommands).toHaveBeenCalledTimes(1);

    await view.rerender(<ChatComposer {...props} commandsOpen />);
    expect(view.getByLabelText('Commands').props.accessibilityState.expanded).toBe(true);
  });

  it('shows who is being replied to, and lets the reply be called off', async () => {
    const onClearReply = jest.fn();
    const props = {
      value: '',
      onChangeText: jest.fn(),
      onSend: jest.fn(),
      onStop: jest.fn(),
      streaming: false,
      bottomInset: 0,
      agentName: 'Hermes',
      onClearReply,
    };
    const view = await render(
      <ChatComposer
        {...props}
        reply={{ id: 'a1', author: 'agent', preview: 'All three jobs are green.' }}
      />,
    );

    expect(view.getByText('Replying to Hermes')).toBeTruthy();
    expect(view.getByText('All three jobs are green.')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Cancel reply'));
    expect(onClearReply).toHaveBeenCalledTimes(1);

    await view.rerender(<ChatComposer {...props} reply={null} />);
    expect(view.queryByText('Replying to Hermes')).toBeNull();
  });

  it('omits the command control when the screen has no menu to open', async () => {
    await render(
      <ChatComposer
        value=""
        onChangeText={jest.fn()}
        onSend={jest.fn()}
        onStop={jest.fn()}
        streaming={false}
        bottomInset={0}
      />,
    );

    expect(screen.queryByLabelText('Commands')).toBeNull();
  });
});
