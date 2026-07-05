import { buildApprovalMessage, submitApproval, submitStop } from '@/ui/chat/approval';

describe('buildApprovalMessage', () => {
  it('builds an action message that carries the run id', () => {
    const msg = buildApprovalMessage('msg-1', {
      runId: 'run_7',
      title: 'Deploy to prod?',
      command: './deploy.sh --prod',
    });
    expect(msg).toEqual({
      id: 'msg-1',
      role: 'action',
      runId: 'run_7',
      title: 'Deploy to prod?',
      command: './deploy.sh --prod',
    });
  });
});

describe('submitApproval', () => {
  it('resolves the run through the adapter with the card run id', async () => {
    const approveRun = jest.fn().mockResolvedValue(undefined);
    const msg = buildApprovalMessage('m', { runId: 'run_9', title: 't', command: 'c' });

    await submitApproval({ approveRun }, msg, true);

    expect(approveRun).toHaveBeenCalledWith('run_9', true);
  });

  it('passes the decision through (deny)', async () => {
    const approveRun = jest.fn().mockResolvedValue(undefined);
    const msg = buildApprovalMessage('m', { runId: 'run_9', title: 't', command: 'c' });

    await submitApproval({ approveRun }, msg, false);

    expect(approveRun).toHaveBeenCalledWith('run_9', false);
  });
});

describe('submitStop', () => {
  it('stops the run through the adapter with the card run id', async () => {
    const stopRun = jest.fn().mockResolvedValue(undefined);
    const msg = buildApprovalMessage('m', { runId: 'run_9', title: 't', command: 'c' });

    await submitStop({ stopRun }, msg);

    expect(stopRun).toHaveBeenCalledWith('run_9');
  });
});
