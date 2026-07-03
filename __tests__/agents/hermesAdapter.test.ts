import { normalizeBaseUrl } from '@/agents/adapters/hermes';
import { ConnectionError } from '@/agents/adapters/types';

describe('normalizeBaseUrl', () => {
  it('defaults bare direct-mode hosts to https', () => {
    expect(normalizeBaseUrl('my-hermes.example.com:8642')).toBe(
      'https://my-hermes.example.com:8642',
    );
  });

  it('preserves explicit https URLs', () => {
    expect(normalizeBaseUrl('https://my-hermes.example.com:8642/')).toBe(
      'https://my-hermes.example.com:8642',
    );
  });

  it('allows explicit http only for local/private direct-mode hosts', () => {
    expect(normalizeBaseUrl('http://localhost:8642')).toBe('http://localhost:8642');
    expect(normalizeBaseUrl('http://100.80.1.2:8642')).toBe('http://100.80.1.2:8642');
    expect(normalizeBaseUrl('http://192.168.1.10:8642')).toBe('http://192.168.1.10:8642');
  });

  it('rejects explicit http for public hosts', () => {
    expect(() => normalizeBaseUrl('http://hermes.example.com:8642')).toThrow(ConnectionError);
  });
});
