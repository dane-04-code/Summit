import {
  QUOTED_CONTEXT_CHARS,
  REPLY_PREVIEW_CHARS,
  buildQuotedContext,
  replyPreview,
  replyRefFor,
  withQuotedContext,
  type Message,
} from '@/ui/chat/types';
import { MENU_HEIGHT, MENU_WIDTH, menuPosition } from '@/ui/chat/MessageActionMenu';

const user: Message = { id: 'u1', role: 'user', text: 'Ship the connector fix today' };
const agent: Message = {
  id: 'a1',
  role: 'agent',
  blocks: [{ kind: 'markdown', source: '## Status\n\nAll three jobs are green.' }],
};

describe('replyPreview', () => {
  it('collapses a message to a single line', () => {
    expect(replyPreview(agent)).toBe('## Status All three jobs are green.');
  });

  it('truncates past the preview cap with an ellipsis', () => {
    const long: Message = { id: 'u2', role: 'user', text: 'x'.repeat(400) };
    const preview = replyPreview(long);
    expect(preview).toHaveLength(REPLY_PREVIEW_CHARS);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('leaves a message exactly at the cap untouched', () => {
    const exact: Message = { id: 'u3', role: 'user', text: 'y'.repeat(REPLY_PREVIEW_CHARS) };
    expect(replyPreview(exact)).toBe('y'.repeat(REPLY_PREVIEW_CHARS));
  });
});

describe('replyRefFor', () => {
  it('freezes id, author, and preview for a user and an agent target', () => {
    expect(replyRefFor(user)).toEqual({
      id: 'u1',
      author: 'user',
      preview: 'Ship the connector fix today',
    });
    expect(replyRefFor(agent)?.author).toBe('agent');
  });

  it('refuses approval cards — an approval is acted on, not replied to', () => {
    const action: Message = {
      id: 'x1',
      role: 'action',
      runId: 'run_1',
      title: 'Run?',
      command: 'rm -rf /tmp/x',
    };
    expect(replyRefFor(action)).toBeNull();
  });
});

describe('buildQuotedContext', () => {
  it('quotes every line of the target, blank lines included', () => {
    expect(buildQuotedContext(agent)).toBe('> ## Status\n>\n> All three jobs are green.');
  });

  it('caps a huge target rather than letting it dominate the turn', () => {
    const huge: Message = { id: 'a2', role: 'agent', blocks: [{ kind: 'markdown', source: 'z'.repeat(9000) }] };
    const quoted = buildQuotedContext(huge);
    // One line, so the body is everything after the "> " marker.
    expect(quoted.slice(2)).toHaveLength(QUOTED_CONTEXT_CHARS);
    expect(quoted.endsWith('…')).toBe(true);
  });

  it('honours an explicit cap at the boundary in both directions', () => {
    const at: Message = { id: 'u4', role: 'user', text: 'abcde' };
    expect(buildQuotedContext(at, 5)).toBe('> abcde');
    expect(buildQuotedContext(at, 4)).toBe('> abc…');
  });

  it('quotes nothing for an empty target', () => {
    const empty: Message = { id: 'a3', role: 'agent', blocks: [{ kind: 'markdown', source: '   ' }] };
    expect(buildQuotedContext(empty)).toBe('');
  });
});

describe('withQuotedContext', () => {
  it('folds the full original in ahead of what was typed', () => {
    expect(withQuotedContext(user, 'how did you get on with this?')).toBe(
      '> Ship the connector fix today\n\nhow did you get on with this?',
    );
  });

  it('passes the typed text through untouched with no reply target', () => {
    expect(withQuotedContext(null, 'plain send')).toBe('plain send');
  });

  it('sends only what was typed when the target has no quotable body', () => {
    const empty: Message = { id: 'a4', role: 'agent', blocks: [] };
    expect(withQuotedContext(empty, 'still fine')).toBe('still fine');
  });
});

describe('menuPosition', () => {
  const screen = { width: 390, height: 844 };

  it('hangs a user bubble menu off its right edge, an agent reply off its left', () => {
    expect(menuPosition({ x: 150, y: 200, width: 220, height: 60, align: 'right' }, screen).left).toBe(
      370 - MENU_WIDTH,
    );
    expect(menuPosition({ x: 18, y: 200, width: 354, height: 60, align: 'left' }, screen).left).toBe(18);
  });

  it('opens below the message when there is room', () => {
    expect(menuPosition({ x: 18, y: 200, width: 200, height: 60, align: 'left' }, screen).top).toBe(268);
  });

  it('flips above the message when the menu would run off the bottom', () => {
    const anchor = { x: 18, y: 760, width: 200, height: 60, align: 'left' as const };
    expect(menuPosition(anchor, screen).top).toBe(760 - MENU_HEIGHT - 8);
  });

  it('never lets a wide or offset message push the menu past a screen edge', () => {
    const offscreen = menuPosition({ x: 340, y: 200, width: 200, height: 60, align: 'left' }, screen);
    expect(offscreen.left).toBe(screen.width - MENU_WIDTH - 12);
    const negative = menuPosition({ x: -40, y: 200, width: 60, height: 60, align: 'left' }, screen);
    expect(negative.left).toBe(12);
  });
});
