// Verifies the relay adapter maps job operations to the right allow-listed REST
// calls and reuses the shared normalizers — without touching a real WebSocket.

const mockRequest = jest.fn();
const mockPair = jest.fn().mockResolvedValue({ framework: 'hermes', agentName: 'H', agentVersion: '1' });

jest.mock('@/agents/relay/client', () => ({
  RelayClient: jest.fn().mockImplementation(() => ({
    pair: mockPair,
    request: mockRequest,
    disconnect: jest.fn(),
    subscribeConnectionState: jest.fn(() => () => {}),
  })),
}));
jest.mock('@/config', () => ({ RELAY_WS_URL: 'ws://test', SIGNUP_ENABLED: false }));

import { RelayAdapter } from '@/agents/adapters/relay';
import type { Agent } from '@/agents/types';

const agent: Agent = {
  id: 'a1',
  name: 'Hermes',
  framework: 'hermes',
  transport: 'relay',
  baseUrl: null,
  capabilities: null,
  createdAt: 0,
  lastUsedAt: 0,
};

function makeAdapter() {
  return new RelayAdapter(agent, async () => '123456');
}

beforeEach(() => {
  mockRequest.mockReset();
});

describe('RelayAdapter jobs over relay', () => {
  it('lists jobs via GET /api/jobs and normalizes the payload', async () => {
    mockRequest.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ jobs: [{ id: 'j1', name: 'Daily briefing', cron: '0 7 * * *' }] }),
    });

    const jobs = await makeAdapter().listJobs();

    expect(mockRequest).toHaveBeenCalledWith('GET', '/api/jobs', undefined);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: 'j1', name: 'Daily briefing' });
  });

  it('triggers a run via POST /api/jobs/{id}/run', async () => {
    mockRequest.mockResolvedValue({ status: 200, body: '' });
    await makeAdapter().triggerJob('j1');
    expect(mockRequest).toHaveBeenCalledWith('POST', '/api/jobs/j1/run', undefined);
  });

  it('pauses and resumes via the matching endpoints', async () => {
    mockRequest.mockResolvedValue({ status: 200, body: '' });
    const adapter = makeAdapter();
    await adapter.pauseJob('j1');
    await adapter.resumeJob('j1');
    expect(mockRequest).toHaveBeenNthCalledWith(1, 'POST', '/api/jobs/j1/pause', undefined);
    expect(mockRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/jobs/j1/resume', undefined);
  });

  it('url-encodes ids', async () => {
    mockRequest.mockResolvedValue({ status: 200, body: '{}' });
    await makeAdapter().getJobRun('a/b');
    expect(mockRequest).toHaveBeenCalledWith('GET', '/api/jobs/a%2Fb', undefined);
  });

  it('routes approve/stop through the runs endpoints', async () => {
    mockRequest.mockResolvedValue({ status: 200, body: '' });
    const adapter = makeAdapter();
    await adapter.approveRun('r1', true);
    await adapter.stopRun('r1');
    expect(mockRequest).toHaveBeenNthCalledWith(1, 'POST', '/v1/runs/r1/approval', { approved: true });
    expect(mockRequest).toHaveBeenNthCalledWith(2, 'POST', '/v1/runs/r1/stop', undefined);
  });

  it('surfaces a friendly error when the connector is offline (502)', async () => {
    mockRequest.mockResolvedValue({ status: 502, body: '' });
    await expect(makeAdapter().listJobs()).rejects.toThrow(/connector online/i);
  });
});
