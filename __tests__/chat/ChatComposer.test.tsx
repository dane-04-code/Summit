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

  it('does not squeeze a line of text between extra vertical padding', async () => {
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
    expect(style.height).toBe(24);
    expect(style.padding).toBe(0);
    expect(style.includeFontPadding).toBe(false);
    expect(input.props.textAlignVertical).toBe('top');
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
      expect(updatedInput.props.textAlignVertical).toBe('top');
    });
  });
});
