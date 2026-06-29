import { RelayAdapter } from '@/agents/adapters/relay';
import type { Agent } from '@/agents/types';
import type { StreamEvent } from '@/agents/adapters/types';

const fakeAgent: Agent = {
  id: 'a1',
  name: 'Test',
  framework: 'hermes',
  transport: 'relay',
  baseUrl: null,
  capabilities: null,
  createdAt: 0,
  lastUsedAt: 0,
};

const mockChatEvents: StreamEvent[] = [
  { type: 'delta', text: 'Hi' },
  { type: 'done' },
];

async function* makeAsyncGen(events: StreamEvent[]) {
  for (const e of events) yield e;
}

const mockPair = jest.fn().mockResolvedValue({ framework: 'hermes', agentName: 'Test', agentVersion: '1' });
const mockChat = jest.fn(() => makeAsyncGen(mockChatEvents));
const mockDisconnect = jest.fn();

jest.mock('@/agents/relay/client', () => ({
  RelayClient: jest.fn(() => ({ pair: mockPair, chat: mockChat, disconnect: mockDisconnect })),
}));

jest.mock('@/config', () => ({
  RELAY_WS_URL: 'ws://test',
  SIGNUP_ENABLED: false,
}));

describe('RelayAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChat.mockImplementation(() => makeAsyncGen(mockChatEvents));
  });

  it('pairs on first sendMessage and yields StreamEvents', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => '481920');
    const events: StreamEvent[] = [];
    for await (const ev of adapter.sendMessage('hello')) {
      events.push(ev);
    }
    expect(mockPair).toHaveBeenCalledWith('481920');
    expect(events).toEqual(mockChatEvents);
  });

  it('does not pair again on second sendMessage', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => '481920');
    for await (const _ of adapter.sendMessage('msg1')) {}
    for await (const _ of adapter.sendMessage('msg2')) {}
    expect(mockPair).toHaveBeenCalledTimes(1);
  });

  it('throws when no pairing code is stored', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => null);
    await expect(async () => {
      for await (const _ of adapter.sendMessage('hi')) {}
    }).rejects.toThrow('No pairing code');
  });
});
