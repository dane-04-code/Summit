import { frameworkLabel, defaultCapabilitiesFor, parseFramework } from '@/agents/frameworks';

describe('frameworkLabel', () => {
  it('names each supported framework', () => {
    expect(frameworkLabel('hermes')).toBe('Hermes');
    expect(frameworkLabel('openclaw')).toBe('OpenClaw');
    expect(frameworkLabel('openai')).toBe('OpenAI-compatible');
  });
});

describe('defaultCapabilitiesFor', () => {
  it('gives Hermes the full native feature set', () => {
    expect(defaultCapabilitiesFor('hermes')).toEqual({
      framework: 'hermes',
      hasRunApproval: true,
      hasRunStop: true,
      hasStreaming: true,
      hasJobs: true,
      hasSessions: true,
    });
  });

  it('gives generic OpenAI-compatible agents the messaging floor only', () => {
    expect(defaultCapabilitiesFor('openai')).toEqual({
      framework: 'openai',
      hasRunApproval: false,
      hasRunStop: false,
      hasStreaming: true,
      hasJobs: false,
      hasSessions: false,
    });
  });

  it('gives OpenClaw messaging plus push approvals', () => {
    const caps = defaultCapabilitiesFor('openclaw');
    expect(caps.framework).toBe('openclaw');
    // The Gateway pushes exec approvals over the connector's persistent WS.
    expect(caps.hasRunApproval).toBe(true);
    // No jobs/sessions/run-stop integration yet — still the floor there.
    expect(caps.hasJobs).toBe(false);
    expect(caps.hasRunStop).toBe(false);
    expect(caps.hasSessions).toBe(false);
  });
});

describe('parseFramework', () => {
  it('passes known frameworks through', () => {
    expect(parseFramework('hermes')).toBe('hermes');
    expect(parseFramework('openclaw')).toBe('openclaw');
    expect(parseFramework('openai')).toBe('openai');
  });

  it('normalizes case and whitespace', () => {
    expect(parseFramework(' Hermes ')).toBe('hermes');
  });

  it('falls back to the generic floor for unknown frameworks', () => {
    expect(parseFramework('some-future-agent')).toBe('openai');
    expect(parseFramework('')).toBe('openai');
  });
});
