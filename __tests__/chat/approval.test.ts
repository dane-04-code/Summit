import {
  buildApprovalMessage,
  resolveApproval,
  submitApproval,
  submitStop,
} from '@/ui/chat/approval';

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

describe('resolveApproval', () => {
  const card = buildApprovalMessage('card-1', {
    runId: 'run_9',
    title: 'Deploy to prod?',
    command: './deploy.sh --prod',
  });

  it('approves the run and returns the approved reply card', async () => {
    const approveRun = jest.fn().mockResolvedValue(undefined);
    const stopRun = jest.fn().mockResolvedValue(undefined);

    const outcome = await resolveApproval({ approveRun, stopRun }, card, 'approve');

    expect(approveRun).toHaveBeenCalledWith('run_9', true);
    expect(stopRun).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toEqual({
      id: 'card-1-result',
      role: 'agent',
      blocks: [{ kind: 'text', spans: [{ text: 'Approved — running the command now.' }] }],
    });
  });

  it('stops the run and returns the stopped reply card', async () => {
    const approveRun = jest.fn().mockResolvedValue(undefined);
    const stopRun = jest.fn().mockResolvedValue(undefined);

    const outcome = await resolveApproval({ approveRun, stopRun }, card, 'stop');

    expect(stopRun).toHaveBeenCalledWith('run_9');
    expect(approveRun).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toEqual({
      id: 'card-1-result',
      role: 'agent',
      blocks: [{ kind: 'text', spans: [{ text: 'Stopped. Nothing was run.' }] }],
    });
  });

  it('returns a muted failure message with the error when the adapter rejects', async () => {
    const boom = new Error('network down');
    const approveRun = jest.fn().mockRejectedValue(boom);
    const stopRun = jest.fn().mockResolvedValue(undefined);

    const outcome = await resolveApproval({ approveRun, stopRun }, card, 'approve');

    expect(outcome).toEqual({
      ok: false,
      error: boom,
      message: {
        id: 'card-1-result',
        role: 'agent',
        blocks: [
          {
            kind: 'text',
            spans: [{ text: 'Couldn’t reach the agent — the run is still waiting.' }],
            tone: 'muted',
          },
        ],
      },
    });
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
