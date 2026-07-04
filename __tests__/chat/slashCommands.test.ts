import { SLASH_COMMANDS, slashQuery, matchCommands } from '@/ui/chat/slashCommands';
import { defaultCapabilitiesFor } from '@/agents/frameworks';

const hermesCaps = defaultCapabilitiesFor('hermes');   // hasJobs: true
const genericCaps = defaultCapabilitiesFor('openai');  // hasJobs: false

const names = (cmds: ReturnType<typeof matchCommands>) => cmds.map((c) => c.name);

describe('slashQuery', () => {
  it('returns the token after a leading slash', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/ne')).toBe('ne');
  });

  it('returns null when it is not a command query', () => {
    expect(slashQuery('hello')).toBeNull();
    expect(slashQuery('')).toBeNull();
    expect(slashQuery('/cron list')).toBeNull(); // space ends the token
    expect(slashQuery(' /new')).toBeNull();       // slash not at start
  });
});

describe('matchCommands', () => {
  it('prefix-matches by command name', () => {
    expect(names(matchCommands('/ne', genericCaps))).toEqual(['new']);
  });

  it('is case-insensitive', () => {
    expect(names(matchCommands('/NEW', genericCaps))).toEqual(['new']);
  });

  it('shows only app commands for a generic agent', () => {
    expect(names(matchCommands('/', genericCaps))).toEqual(['new', 'clear', 'settings']);
  });

  it('adds the gated /cron command when hasJobs is true', () => {
    expect(names(matchCommands('/', hermesCaps))).toEqual(['new', 'clear', 'settings', 'cron']);
  });

  it('hides a gated command when the flag is false or capabilities are null', () => {
    expect(matchCommands('/cron', genericCaps)).toEqual([]);
    expect(matchCommands('/cron', null)).toEqual([]);
  });

  it('returns the gated command when its flag is true', () => {
    expect(names(matchCommands('/cron', hermesCaps))).toEqual(['cron']);
  });

  it('returns empty for a non-query or no match', () => {
    expect(matchCommands('hello', hermesCaps)).toEqual([]);
    expect(matchCommands('/zzz', hermesCaps)).toEqual([]);
  });
});
