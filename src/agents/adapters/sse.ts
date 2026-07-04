/**
 * Shared SSE chat-completions streaming — the OpenAI wire format won the
 * industry, so Hermes and every Tier 2 server stream the same
 * `data: {choices:[{delta:{content}}]}` … `data: [DONE]` frames. Adapters
 * differ only in URL, headers, body, and framework-specific named events.
 */

import EventSource from 'react-native-sse';

import { EventQueue } from './stream';
import type { StreamEvent } from './types';

export type SseChatParams = {
  url: string;
  /** Resolved just before the request — the secret lives in the Keychain. */
  getHeaders: () => Promise<Record<string, string>>;
  body: Record<string, unknown>;
  /** Framework-specific named SSE events (e.g. `hermes.tool.progress`). */
  customEvents?: Record<
    string,
    (data: string | null | undefined, push: (event: StreamEvent) => void) => void
  >;
  /** Any frame arrived — the connection is live. */
  onActivity?: () => void;
  /** The stream failed or dropped. */
  onDisconnected?: () => void;
};

export function streamChatCompletions({
  url,
  getHeaders,
  body,
  customEvents = {},
  onActivity,
  onDisconnected,
}: SseChatParams): AsyncIterable<StreamEvent> {
  const queue = new EventQueue<StreamEvent>();

  void (async () => {
    let headers: Record<string, string>;
    try {
      headers = await getHeaders();
    } catch (err) {
      onDisconnected?.();
      queue.push({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not start the stream.',
      });
      queue.close();
      return;
    }

    const es = new EventSource<string>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      pollingInterval: 0, // one-shot stream, don't reconnect
    });

    const close = () => {
      es.removeAllEventListeners();
      es.close();
      queue.close();
    };

    es.addEventListener('message', (event) => {
      onActivity?.();
      const data = (event as { data?: string | null }).data;
      if (!data) return;
      if (data.trim() === '[DONE]') {
        queue.push({ type: 'done' });
        close();
        return;
      }
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) queue.push({ type: 'delta', text });
      } catch {
        // keep-alive or non-JSON frame — ignore
      }
    });

    for (const [name, handle] of Object.entries(customEvents)) {
      es.addEventListener(name, (event) => {
        onActivity?.();
        handle((event as { data?: string | null }).data, (e) => queue.push(e));
      });
    }

    es.addEventListener('error', () => {
      onDisconnected?.();
      queue.push({ type: 'error', message: 'The connection to the agent dropped.' });
      close();
    });
  })();

  return queue;
}
