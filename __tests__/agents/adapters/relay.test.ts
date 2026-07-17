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
const mockResume = jest.fn().mockResolvedValue({ framework: 'hermes', agentName: 'Test', agentVersion: '1' });
const mockChat = jest.fn((_messages?: unknown, _requestId?: string) => makeAsyncGen(mockChatEvents));
const mockDisconnect = jest.fn();
const mockRegisterPush = jest.fn().mockResolvedValue(undefined);
const mockResolveApproval = jest.fn().mockResolvedValue(undefined);
const mockRequest = jest.fn().mockResolvedValue({ status: 200, body: '{}' });

jest.mock('@/agents/relay/client', () => ({
  RelayClient: jest.fn(() => ({
    pair: mockPair,
    resume: mockResume,
    chat: mockChat,
    disconnect: mockDisconnect,
    registerPush: mockRegisterPush,
    resolveApproval: mockResolveApproval,
    request: mockRequest,
    subscribeConnectionState: jest.fn(() => () => {}),
  })),
}));

jest.mock('@/config', () => ({
  RELAY_WS_URL: 'ws://test',
  SIGNUP_ENABLED: false,
}));

describe('RelayAdapter', () => {
  const credential = JSON.stringify({ code: '481920', token: 't'.repeat(43) });
  beforeEach(() => {
    jest.clearAllMocks();
    mockChat.mockImplementation(() => makeAsyncGen(mockChatEvents));
  });

  it('pairs on first sendMessage and yields StreamEvents', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => credential);
    const events: StreamEvent[] = [];
    for await (const ev of adapter.sendMessage('hello')) {
      events.push(ev);
    }
    expect(mockResume).toHaveBeenCalledWith('t'.repeat(43));
    expect(events).toEqual(mockChatEvents);
  });

  it('does not pair again on second sendMessage', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => credential);
    for await (const _ of adapter.sendMessage('msg1')) {}
    for await (const _ of adapter.sendMessage('msg2')) {}
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  it('uses a unique request id for each message', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => credential);
    for await (const _ of adapter.sendMessage('msg1')) {}
    for await (const _ of adapter.sendMessage('msg2')) {}

    expect(mockChat.mock.calls[0][1]).toBe('req-1');
    expect(mockChat.mock.calls[1][1]).toBe('req-2');
  });

  it('throws when no pairing code is stored', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => null);
    await expect(async () => {
      for await (const _ of adapter.sendMessage('hi')) {}
    }).rejects.toThrow('No relay credential stored');
  });

  it('registers the push token after pairing', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => credential, async () => 'ExponentPushToken[t1]');
    for await (const _ of adapter.sendMessage('hello')) {}
    // registration is fire-and-forget — let the microtask settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterPush).toHaveBeenCalledWith('ExponentPushToken[t1]');
  });

  it('skips registration when no token is available', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => credential, async () => null);
    for await (const _ of adapter.sendMessage('hello')) {}
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterPush).not.toHaveBeenCalled();
  });

  describe('run approval routing', () => {
    const openclawAgent: Agent = { ...fakeAgent, framework: 'openclaw' };

    it('resolves OpenClaw approvals with approval_resolve frames', async () => {
      const adapter = new RelayAdapter(openclawAgent, async () => credential);
      await adapter.approveRun('ap-1', true);
      expect(mockResolveApproval).toHaveBeenCalledWith('ap-1', 'approve');
      await adapter.approveRun('ap-2', false);
      expect(mockResolveApproval).toHaveBeenCalledWith('ap-2', 'deny');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('maps OpenClaw stopRun to a deny decision', async () => {
      const adapter = new RelayAdapter(openclawAgent, async () => credential);
      await adapter.stopRun('ap-3');
      expect(mockResolveApproval).toHaveBeenCalledWith('ap-3', 'deny');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('keeps Hermes approvals on the REST proxy', async () => {
      const adapter = new RelayAdapter(fakeAgent, async () => credential);
      await adapter.approveRun('run-1', true);
      expect(mockRequest).toHaveBeenCalledWith('POST', '/v1/runs/run-1/approval', { approved: true });
      expect(mockResolveApproval).not.toHaveBeenCalled();
    });
  });
});
