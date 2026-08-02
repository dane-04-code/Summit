/**
 * The agent identity mark: persistence round-trip, the two independent halves,
 * and graceful degradation when a stored value isn't one we know.
 *
 * The degradation cases are the ones that matter in the field — a device that
 * downgrades a build, or a row written by a future version, must render the
 * neutral default rather than crash the switcher.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { buildAgent } from '@/agents/registry';
import { InMemoryRepository } from '@/db/memory';
import { AGENT_COLUMN_MIGRATIONS } from '@/db/schema';
import { AGENT_AVATAR_IDS, AgentAvatar, accentHex, resolveAvatarId } from '@/ui/agentIdentity/avatars';
import { agentAccentNames, agentAccentPalette, colors, resolveAccent } from '@/theme';
import { Sidebar, type AgentOption } from '@/ui/chat/Sidebar';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// ── Persistence ─────────────────────────────────────────────────────────────

describe('identity persistence', () => {
  it('round-trips both halves through the store', async () => {
    const repo = new InMemoryRepository();
    await repo.init();

    const agent = buildAgent({
      name: 'Workshop',
      framework: 'hermes',
      transport: 'relay',
      baseUrl: null,
    });
    await repo.upsertAgent({ ...agent, avatarId: 'ridge', accentColor: 'teal' });

    const [reloaded] = await repo.listAgents();
    expect(reloaded.avatarId).toBe('ridge');
    expect(reloaded.accentColor).toBe('teal');
  });

  it('leaves a freshly paired agent unmarked', () => {
    const agent = buildAgent({
      name: 'Server box',
      framework: 'openclaw',
      transport: 'relay',
      baseUrl: null,
    });
    expect(agent.avatarId).toBeNull();
    expect(agent.accentColor).toBeNull();
  });

  it('keeps each half settable without disturbing the other', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const agent = buildAgent({
      name: 'Workshop',
      framework: 'hermes',
      transport: 'relay',
      baseUrl: null,
    });

    await repo.upsertAgent({ ...agent, accentColor: 'violet' });
    let [row] = await repo.listAgents();
    expect(row.avatarId).toBeNull();
    expect(row.accentColor).toBe('violet');

    await repo.upsertAgent({ ...row, avatarId: 'peak' });
    [row] = await repo.listAgents();
    expect(row.avatarId).toBe('peak');
    expect(row.accentColor).toBe('violet');
  });

  it('ships an additive migration for every post-release agent column', () => {
    // A column added to the CREATE TABLE without a matching ALTER would be
    // missing on any device that paired before it shipped.
    for (const column of AGENT_COLUMN_MIGRATIONS) {
      expect(column.ddl).toContain(`ADD COLUMN ${column.name}`);
      // Must be nullable with no default, or the ALTER fails on a table with rows.
      expect(column.ddl).not.toMatch(/NOT NULL|DEFAULT/);
    }
    expect(AGENT_COLUMN_MIGRATIONS.map((c) => c.name)).toEqual(
      expect.arrayContaining(['avatar_id', 'accent_color']),
    );
  });
});

// ── Value resolution ────────────────────────────────────────────────────────

describe('identity value resolution', () => {
  it('accepts every shipped glyph and accent id', () => {
    for (const id of AGENT_AVATAR_IDS) expect(resolveAvatarId(id)).toBe(id);
    for (const name of agentAccentNames) expect(resolveAccent(name)).toBe(name);
  });

  it('rejects unknown, empty, and absent values', () => {
    for (const bad of ['worker-01', '', null, undefined, '__proto__']) {
      expect(resolveAvatarId(bad)).toBeNull();
      expect(resolveAccent(bad)).toBeNull();
    }
  });

  it('never offers the app accent itself as an agent color', () => {
    // An agent mark that used `colors.accent` could be misread as a link or a
    // focus ring — the palette is deliberately disjoint from it.
    expect(Object.values(agentAccentPalette)).not.toContain(colors.accent);
  });

  it('keeps the palette free of the colors that already carry meaning', () => {
    const values = Object.values(agentAccentPalette) as string[];
    expect(values).not.toContain(colors.error);
    expect(values).not.toContain(colors.success);
  });

  it('exposes ten distinct glyphs and ten distinct colors', () => {
    expect(new Set(AGENT_AVATAR_IDS).size).toBe(10);
    expect(new Set(Object.values(agentAccentPalette)).size).toBe(10);
  });

  it('resolves an accent to its hex, and an unknown one to null', () => {
    expect(accentHex('teal')).toBe(agentAccentPalette.teal);
    expect(accentHex('chartreuse')).toBeNull();
  });
});

// ── Rendering ───────────────────────────────────────────────────────────────

describe('AgentAvatar', () => {
  const combinations: [string, string | null, string | null][] = [
    ['both halves set', 'ridge', 'teal'],
    ['glyph only', 'ridge', null],
    ['accent only', null, 'teal'],
    ['neither', null, null],
    // Values written by a build we don't know about.
    ['unrecognized values', 'worker-07', 'ultraviolet'],
    // The prototype-chain trap: these must not resolve to a "valid" key.
    ['prototype-chain keys', '__proto__', '__proto__'],
  ];

  it.each(combinations)('renders with %s', async (_label, avatarId, accent) => {
    const view = await render(<AgentAvatar avatarId={avatarId} accent={accent} size={28} />);
    expect(view.toJSON()).toBeTruthy();
  });

  // One render per case: this repo's `render` is async, and several in a
  // single test overlap their `act()` scopes.
  it.each(AGENT_AVATAR_IDS)('draws the %s glyph', async (id) => {
    const view = await render(<AgentAvatar avatarId={id} accent="teal" size={28} />);
    expect(view.toJSON()).toBeTruthy();
  });
});

// ── The switcher row ────────────────────────────────────────────────────────

async function renderSidebar(agents: AgentOption[]) {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <Sidebar
        visible
        groups={[]}
        activeId=""
        title="Workshop"
        subtitle="Hermes"
        agents={agents}
        activeAgentId={agents[0]?.id ?? null}
        onSelectAgent={jest.fn()}
        onAddAgent={jest.fn()}
        connectionState="connected"
        account={{ name: 'Dane', initial: 'D' }}
        showCron={false}
        onClose={jest.fn()}
        onNewChat={jest.fn()}
        onSelectChat={jest.fn()}
        onRenameChat={jest.fn()}
        onDeleteChat={jest.fn()}
        onOpenSettings={jest.fn()}
        onOpenCron={jest.fn()}
      />
    </SafeAreaProvider>,
  );
}

describe('sidebar switcher rows', () => {
  const cases: [string, AgentOption[]][] = [
    ['no agents', []],
    ['one unmarked agent', [{ id: 'a1', name: 'Workshop', frameworkLabel: 'Hermes' }]],
    [
      'a mix of marked and unmarked agents',
      [
        { id: 'a1', name: 'Workshop', frameworkLabel: 'Hermes', avatarId: 'ridge', accentColor: 'teal' },
        { id: 'a2', name: 'Server box', frameworkLabel: 'OpenClaw' },
        { id: 'a3', name: 'Laptop', frameworkLabel: 'Ollama', accentColor: 'rose' },
        { id: 'a4', name: 'Spare', frameworkLabel: 'Hermes', avatarId: 'peak' },
      ],
    ],
    [
      'agents carrying unrecognized values',
      [
        { id: 'a1', name: 'Workshop', frameworkLabel: 'Hermes', avatarId: 'worker-01', accentColor: '#ff0000' },
        { id: 'a2', name: 'Server box', frameworkLabel: 'OpenClaw', avatarId: null, accentColor: null },
      ],
    ],
  ];

  it.each(cases)('renders with %s', async (_label, agents) => {
    await renderSidebar(agents);

    // The switcher only exists past one agent; below that there are no rows to
    // draw a mark on and the header stays a plain label.
    if (agents.length < 2) {
      expect(screen.queryByLabelText('Workshop, switch agent')).toBeNull();
      return;
    }

    await fireEvent.press(screen.getByLabelText('Workshop, switch agent'));
    for (const agent of agents) {
      // Every row still announces itself by name — the mark is additive, and
      // an unknown value must never take the row down with it.
      expect(screen.getByLabelText(`${agent.name}, ${agent.frameworkLabel}`)).toBeTruthy();
    }
  });
});
