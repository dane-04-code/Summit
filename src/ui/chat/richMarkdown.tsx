/**
 * Shared renderer that turns an agent's markdown into the Summit
 * "text style" (Rich Rendering design). Used by both the chat thread and the
 * doc reader. Built on react-native-markdown-display with:
 *   • markdown-it-mark for ==highlight==
 *   • a small math plugin ($…$ inline, $$…$$ block — see mathRender.tsx)
 *   • a task-list plugin ([ ] / [x] / [!] → styled checkboxes)
 * and custom render rules for the code block, blockquote card, link chips, and
 * task checklist card. Everything else (bold/italic/strike/code/lists/tables/
 * headings/links) is plain GFM, styled with design tokens.
 *
 * Links ending in .md are intercepted: tapping fetches the content and opens
 * the full-screen MdReader rather than leaving the app.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, Platform } from 'react-native';
import Markdown, {
  MarkdownIt,
  hasParents,
  type RenderRules,
  type ASTNode,
} from 'react-native-markdown-display';
import markdownItMark from 'markdown-it-mark';
import { Check, X, ExternalLink } from 'lucide-react-native';

import { colors, space } from '../../theme';
import { CodeBlock } from './CodeBlock';
import { MathInline, MathBlock } from './mathRender';
import { richPlugins } from './markdownItPlugins';
import type { MarkdownFile } from './types';

export const MAX_MARKDOWN_CHARS = 64000;
export const MAX_MARKDOWN_LINES = 2000;
export const MAX_MARKDOWN_LINE_CHARS = 2000;

export function boundMarkdownSource(source: string): string {
  let truncated = false;
  const boundedLines = source
    .split('\n')
    .slice(0, MAX_MARKDOWN_LINES)
    .map((line) => {
      if (line.length <= MAX_MARKDOWN_LINE_CHARS) return line;
      truncated = true;
      return `${line.slice(0, MAX_MARKDOWN_LINE_CHARS)}\n\n[Line truncated for safety]`;
    });

  if (source.split('\n').length > MAX_MARKDOWN_LINES) truncated = true;

  let bounded = boundedLines.join('\n');
  if (bounded.length > MAX_MARKDOWN_CHARS) {
    bounded = bounded.slice(0, MAX_MARKDOWN_CHARS);
    truncated = true;
  }

  return truncated ? `${bounded}\n\n[Output truncated for safety]` : bounded;
}

const md = MarkdownIt({ typographer: false, linkify: false, breaks: false })
  .use(markdownItMark)
  .use(richPlugins);

// ── AST helpers (link-row detection) ─────────────────────────────────────────

function astText(node: ASTNode): string {
  if (node.type === 'text') return node.content ?? '';
  return (node.children ?? []).map(astText).join('');
}

/** If a node's subtree is only links + whitespace, return those links; else null. */
function collectLinks(node: ASTNode): { text: string; href: string }[] | null {
  if (node.type === 'link') {
    return [{ text: astText(node), href: node.attributes?.href ?? '' }];
  }
  if (node.type === 'text' || node.type === 'softbreak' || node.type === 'hardbreak') {
    return (node.content ?? '').trim() === '' ? [] : null;
  }
  if (node.type === 'image' || node.type === 'code_inline') return null;
  const acc: { text: string; href: string }[] = [];
  for (const child of node.children ?? []) {
    const r = collectLinks(child);
    if (r === null) return null;
    acc.push(...r);
  }
  return acc;
}

const isTaskList = (node: ASTNode): boolean =>
  (node.children ?? []).some((c) => !!c.attributes?.['data-task']);

// ── Sub-components ───────────────────────────────────────────────────────────

function TaskCheckbox({ state }: { state: string }) {
  if (state === 'done') {
    return (
      <View style={[s.box, s.boxDone]}>
        <Check size={11} color={colors.bg} strokeWidth={2.2} />
      </View>
    );
  }
  if (state === 'blocked') {
    return (
      <View style={[s.box, s.boxBlocked]}>
        <X size={10} color={colors.error} strokeWidth={2} />
      </View>
    );
  }
  return <View style={[s.box, s.boxOpen]} />;
}

function TaskItem({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <View style={s.taskRow}>
      <TaskCheckbox state={state} />
      <View style={s.taskBody}>{children}</View>
      {state === 'blocked' && (
        <View style={s.blockedBadge}>
          <Text style={s.blockedText}>BLOCKED</Text>
        </View>
      )}
    </View>
  );
}

function LinkChips({ links }: { links: { text: string; href: string }[] }) {
  return (
    <View style={s.chips}>
      {links.map((l, i) => (
        <Text
          key={i}
          style={s.chip}
          onPress={() => {
            if (l.href) Linking.openURL(l.href).catch(() => {});
          }}
          accessibilityRole="link"
        >
          {l.text}
          <Text> </Text>
          <ExternalLink size={11} color={colors.accent} strokeWidth={1.5} />
        </Text>
      ))}
    </View>
  );
}

// ── .md link fetcher ─────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function MdLinkButton({
  href,
  onOpen,
  children,
}: {
  href: string;
  onOpen: (file: MarkdownFile) => void;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const source = await res.text();
      const name = decodeURIComponent(href.split('/').pop()?.split('?')[0] ?? 'file.md');
      onOpen({
        name,
        source,
        sizeLabel: formatBytes(source.length),
        lineCount: source.split('\n').length,
      });
    } catch {
      // fall back to browser if fetch fails (CORS, auth, etc.)
      Linking.openURL(href).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Text onPress={handlePress} style={s.mdLink}>
      {children}
      {loading ? <Text style={s.mdLinkLoading}> …</Text> : null}
    </Text>
  );
}

// ── RichMarkdown ─────────────────────────────────────────────────────────────

export function RichMarkdown({
  source,
  onOpenMdFile,
}: {
  source: string;
  onOpenMdFile?: (file: MarkdownFile) => void;
}) {
  const boundedSource = boundMarkdownSource(source);

  // Rules are defined inside the component so the link rule can close over
  // onOpenMdFile. The React Compiler memoizes this when the prop is stable.
  const rules: RenderRules = {
    fence: (node) => (
      <CodeBlock
        key={node.key}
        code={node.content}
        language={(node as ASTNode & { sourceInfo?: string }).sourceInfo}
      />
    ),
    code_block: (node) => <CodeBlock key={node.key} code={node.content} />,

    math_inline: (node) => <MathInline key={node.key} value={node.content} />,
    math_block: (node) => (
      <View key={node.key} style={s.mathBlockWrap}>
        <MathBlock value={node.content} />
      </View>
    ),

    mark: (node, children) => (
      <Text key={node.key} style={s.mark}>
        {children}
      </Text>
    ),

    // Wide tables scroll horizontally instead of squishing/clipping on a phone
    // (cells get a minWidth floor so columns stay readable — see mdStyles.th/td).
    table: (node, children) => (
      <ScrollView
        key={node.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="md-table-scroll"
      >
        <View style={mdStyles.table}>{children}</View>
      </ScrollView>
    ),

    bullet_list: (node, children, parent, styles) => {
      if (isTaskList(node)) {
        return (
          <View key={node.key} style={s.taskCard}>
            {children}
          </View>
        );
      }
      return (
        <View key={node.key} style={styles._VIEW_SAFE_bullet_list}>
          {children}
        </View>
      );
    },

    list_item: (node, children, parent) => {
      const task = node.attributes?.['data-task'];
      if (task) {
        return (
          <TaskItem key={node.key} state={task}>
            {children}
          </TaskItem>
        );
      }
      if (hasParents(parent, 'ordered_list')) {
        return (
          <View key={node.key} style={s.li}>
            <Text style={s.olMarker}>{node.index + 1}.</Text>
            <View style={s.liBody}>{children}</View>
          </View>
        );
      }
      return (
        <View key={node.key} style={s.li}>
          <View style={s.bullet} />
          <View style={s.liBody}>{children}</View>
        </View>
      );
    },

    blockquote: (node, children) => (
      <View key={node.key} style={s.quote}>
        <Text style={s.quoteMark} selectable={false}>
          "
        </Text>
        <View>{children}</View>
      </View>
    ),

    paragraph: (node, children, parent, styles) => {
      const links = collectLinks(node);
      if (links && links.length >= 2) {
        return <LinkChips key={node.key} links={links} />;
      }
      return (
        <View key={node.key} style={styles._VIEW_SAFE_paragraph}>
          {children}
        </View>
      );
    },

    link: (node, children, _parent, styles) => {
      const href = node.attributes?.href ?? '';
      if (onOpenMdFile && /\.md$/i.test(href.split('?')[0])) {
        return (
          <MdLinkButton key={node.key} href={href} onOpen={onOpenMdFile}>
            {children}
          </MdLinkButton>
        );
      }
      return (
        <Text
          key={node.key}
          style={styles.link}
          onPress={() => Linking.openURL(href).catch(() => {})}
        >
          {children}
        </Text>
      );
    },
  };

  return (
    <Markdown markdownit={md} style={mdStyles} rules={rules}>
      {boundedSource}
    </Markdown>
  );
}

// ── Markdown element styles (merged over library defaults) ───────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const mdStyles = StyleSheet.create({
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  paragraph: { marginTop: 0, marginBottom: space.md, fontSize: 16, lineHeight: 24, color: colors.ink },
  heading1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
    marginTop: space.xs,
    marginBottom: space.sm + 1,
  },
  heading2: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: space.lg + 2,
    marginBottom: space.sm + 2,
  },
  heading3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.ink,
    marginTop: space.md,
    marginBottom: space.xs + 2,
  },
  strong: { fontWeight: '700', color: colors.ink },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through', color: colors.muted },
  link: { color: colors.accent, textDecorationLine: 'none' },
  hr: { backgroundColor: colors.line, height: 1, marginVertical: space.lg },

  blockquote: { fontSize: 15, lineHeight: 22, color: colors.ink2, fontStyle: 'italic' },

  bullet_list: { marginTop: space.xs, marginBottom: space.xs },
  ordered_list: { marginTop: space.xs, marginBottom: space.xs },

  code_inline: {
    fontFamily: MONO,
    fontSize: 13.5,
    color: colors.ink,
    backgroundColor: colors.surface2,
    borderWidth: 0,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },

  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  thead: { backgroundColor: colors.drawer },
  tr: { borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row' },
  th: {
    minWidth: 88,
    paddingVertical: space.sm + 1,
    paddingHorizontal: space.md + 1,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '400',
    color: colors.muted,
  },
  td: {
    minWidth: 88,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md + 1,
    fontSize: 15,
    color: colors.ink,
  },
});

// ── Component-local styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  mark: { backgroundColor: colors.highlightBg, color: colors.ink },

  mathBlockWrap: { marginVertical: space.xs },

  // bullets / ordered list
  li: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.sm + 1 },
  liBody: { flex: 1 },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 9,
    marginRight: space.md - 1,
  },
  olMarker: { fontSize: 16, lineHeight: 24, color: colors.muted, marginRight: space.sm },

  // task list
  taskCard: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.md + 3,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: space.md - 1, marginVertical: space.xs + 2 },
  taskBody: { flex: 1 },
  box: {
    width: 19,
    height: 19,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: colors.mdString },
  boxOpen: { borderWidth: 1.5, borderColor: colors.lineFocus },
  boxBlocked: { borderWidth: 1.5, borderColor: colors.error },
  blockedBadge: {
    backgroundColor: colors.errorSurface,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  blockedText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.error,
  },

  // blockquote card
  quote: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    marginVertical: space.xs,
  },
  quoteMark: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 34,
    lineHeight: 20,
    height: 16,
    color: colors.lineFocus,
  },

  // link chips (all-link paragraphs)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9999,
    paddingHorizontal: space.md - 1,
    paddingVertical: space.xs + 1,
    fontSize: 13,
    color: colors.accent,
    overflow: 'hidden',
  },

  // .md link — tapping fetches + opens reader
  mdLink: { color: colors.accent, textDecorationLine: 'none' },
  mdLinkLoading: { color: colors.muted },
});
