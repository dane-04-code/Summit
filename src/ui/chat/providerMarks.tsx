/**
 * Provider marks for the model picker.
 *
 * Every mark is drawn here as vector paths rather than shipped as a vendor
 * logo file — the picker needs a glyph the eye can sort a list by, not a
 * faithful reproduction of anyone's trademark, and hand-drawn paths keep the
 * bundle free of third-party binaries with their own licence terms.
 *
 * Hermes reports provider slugs from a wide alias table (`hermes_cli/models.py`
 * lists `x-ai`, `x.ai`, `xai-oauth`, … for one vendor), so `markFor` normalizes
 * before matching and falls back to an initial tile for anything unrecognized —
 * including the user's own custom endpoints.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors, typography } from '@/theme';

export const MARK_SIZE = 26;

type MarkProps = { color: string };

/** Slug → canonical vendor key. Order matters: longest prefixes first. */
const ALIASES: [RegExp, string][] = [
  [/^(anthropic|claude)/, 'anthropic'],
  [/^(openai|codex)/, 'openai'],
  [/^(google|gemini|vertex|gcp)/, 'google'],
  [/^(meta|llama)/, 'meta'],
  [/^mistral/, 'mistral'],
  [/^(xai|x-ai|x\.ai|grok)/, 'xai'],
  [/^deep-?seek/, 'deepseek'],
  [/^(qwen|alibaba|aliyun|dashscope)/, 'qwen'],
  [/^(moonshot|kimi)/, 'moonshot'],
  [/^minimax/, 'minimax'],
  [/^nous/, 'nous'],
  [/^openrouter/, 'openrouter'],
  [/^groq/, 'groq'],
  [/^ollama/, 'ollama'],
  [/^lm[-_]?studio/, 'lmstudio'],
  [/^(hugging-?face|hf)/, 'huggingface'],
  [/^(zhipu|z-?ai|z\.ai|glm)/, 'zhipu'],
  [/^(nvidia|nim|nemotron|build-nvidia)/, 'nvidia'],
  [/^(amazon|aws|bedrock)/, 'amazon'],
  [/^(azure|microsoft|phi)/, 'azure'],
  [/^(github|copilot)/, 'github'],
  [/^(fireworks|fw)/, 'fireworks'],
  [/^together/, 'together'],
  [/^vercel/, 'vercel'],
  [/^moa/, 'moa'],
];

/** Brand-adjacent tints, dark-surface legible. */
const TINTS: Record<string, string> = {
  anthropic: '#D97757',
  openai: '#E8E8EA',
  google: '#7BA6F5',
  meta: '#4C8DF6',
  mistral: '#FA8B3C',
  xai: '#E8E8EA',
  deepseek: '#6E86FF',
  qwen: '#8F8AF0',
  moonshot: '#B9B4FF',
  minimax: '#F2607A',
  nous: '#E8E8EA',
  openrouter: '#9AA0AA',
  groq: '#F5704F',
  ollama: '#E8E8EA',
  lmstudio: '#9AD6E0',
  huggingface: '#FFD84D',
  zhipu: '#6B85FF',
  nvidia: '#93CC33',
  amazon: '#FFAE3D',
  azure: '#5BA8F5',
  github: '#E8E8EA',
  fireworks: '#9B6BFF',
  together: '#6FC8D6',
  vercel: '#E8E8EA',
  moa: colors.accent,
};

// --- the marks -------------------------------------------------------------
// One 24×24 viewBox each, drawn to read at 14px.

const MARKS: Record<string, (props: MarkProps) => React.ReactElement> = {
  // Radiating spokes.
  anthropic: ({ color }) => (
    <G>
      {[0, 60, 120].map((angle) => (
        <Rect
          key={angle}
          x={11}
          y={2.5}
          width={2}
          height={19}
          rx={1}
          fill={color}
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </G>
  ),
  // Interlocking knot, reduced to two offset rings.
  openai: ({ color }) => (
    <G>
      <Circle cx={9.6} cy={12} r={6.4} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={14.4} cy={12} r={6.4} stroke={color} strokeWidth={1.6} fill="none" />
    </G>
  ),
  // Four-point sparkle.
  google: ({ color }) => (
    <Path
      d="M12 2c.5 5 4.5 9 10 10-5.5 1-9.5 5-10 10-.5-5-4.5-9-10-10 5.5-1 9.5-5 10-10Z"
      fill={color}
    />
  ),
  // Infinity loop.
  meta: ({ color }) => (
    <Path
      d="M3 12c0-3 1.6-5 3.7-5 3.4 0 5 10 8.6 10 2.1 0 3.7-2 3.7-5s-1.6-5-3.7-5c-2.6 0-4.3 2.7-5.6 5.4"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      fill="none"
    />
  ),
  // Stacked bars, the tallest first.
  mistral: ({ color }) => (
    <G>
      {[3, 8, 13, 18].map((x, index) => (
        <Rect key={x} x={x} y={4} width={3.4} height={16 - index * 3} rx={0.8} fill={color} />
      ))}
    </G>
  ),
  // The slashed X.
  xai: ({ color }) => (
    <G stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M4 4 20 20" />
      <Path d="M20 4 4 20" />
    </G>
  ),
  // A diving curve.
  deepseek: ({ color }) => (
    <Path
      d="M3 15c4.5 3.5 10 3 13.5-1.2C19 10.6 19.4 7.4 18 4.5c-1.4 3.6-4 5.6-7.6 5.8"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  // Six-petal rosette.
  qwen: ({ color }) => (
    <G>
      {[0, 60, 120].map((angle) => (
        <Rect
          key={angle}
          x={4}
          y={10.6}
          width={16}
          height={2.8}
          rx={1.4}
          fill={color}
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </G>
  ),
  // Crescent.
  moonshot: ({ color }) => (
    <Path d="M17.5 16.5A8 8 0 0 1 9 4.2a8.5 8.5 0 1 0 8.5 12.3Z" fill={color} />
  ),
  // Ascending steps.
  minimax: ({ color }) => (
    <G>
      {[0, 1, 2].map((index) => (
        <Rect
          key={index}
          x={4 + index * 5.6}
          y={18 - index * 5}
          width={3.6}
          height={2 + index * 5}
          rx={1}
          fill={color}
        />
      ))}
    </G>
  ),
  // A summit.
  nous: ({ color }) => (
    <Path d="M12 3.5 21 20H3l9-16.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" fill="none" />
  ),
  // A routing fork.
  openrouter: ({ color }) => (
    <G stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M3 12h5l4-5h9" />
      <Path d="M12 17h9" />
      <Path d="M8 12l4 5" />
    </G>
  ),
  // A cut circle.
  groq: ({ color }) => (
    <Path
      d="M12 4a8 8 0 1 0 8 8h-8"
      stroke={color}
      strokeWidth={2.1}
      strokeLinecap="round"
      fill="none"
    />
  ),
  // A standing form.
  ollama: ({ color }) => (
    <G fill={color}>
      <Path d="M8 3.5c1 0 1.6 1.5 1.7 3.3h4.6C14.4 5 15 3.5 16 3.5s1.7 1.9 1.4 4.2C18.4 9 19 10.5 19 12c0 4.4-3.1 7.5-7 7.5S5 16.4 5 12c0-1.5.6-3 1.6-4.3C6.3 5.4 7 3.5 8 3.5Z" />
    </G>
  ),
  // A terminal window.
  lmstudio: ({ color }) => (
    <G stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Rect x={3.5} y={4.5} width={17} height={15} rx={3} />
      <Path d="M7.5 10l2.5 2.5L7.5 15" />
      <Path d="M12.5 15.2h4" />
    </G>
  ),
  // A face.
  huggingface: ({ color }) => (
    <G>
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.7} fill="none" />
      <Circle cx={9.2} cy={10.2} r={1.2} fill={color} />
      <Circle cx={14.8} cy={10.2} r={1.2} fill={color} />
      <Path d="M8.4 14.2a4.4 4.4 0 0 0 7.2 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </G>
  ),
  // A cut hexagon.
  zhipu: ({ color }) => (
    <G stroke={color} strokeWidth={1.7} strokeLinejoin="round" fill="none">
      <Path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3Z" />
      <Path d="M9 9h6l-6 6h6" strokeLinecap="round" />
    </G>
  ),
  // An eye.
  nvidia: ({ color }) => (
    <G>
      <Path
        d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={2.4} fill={color} />
    </G>
  ),
  // A smile arrow.
  amazon: ({ color }) => (
    <G stroke={color} strokeWidth={1.9} strokeLinecap="round" fill="none">
      <Path d="M3.5 14.5c5 3.6 12 3.6 17 0" />
      <Path d="M16.5 16.6l4-2.1-.8 4.2" strokeLinejoin="round" />
    </G>
  ),
  // Four panes.
  azure: ({ color }) => (
    <G fill={color}>
      <Rect x={3.5} y={3.5} width={7.5} height={7.5} rx={1} />
      <Rect x={13} y={3.5} width={7.5} height={7.5} rx={1} />
      <Rect x={3.5} y={13} width={7.5} height={7.5} rx={1} />
      <Rect x={13} y={13} width={7.5} height={7.5} rx={1} />
    </G>
  ),
  // A branch.
  github: ({ color }) => (
    <G stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none">
      <Circle cx={7} cy={5.5} r={2.3} />
      <Circle cx={7} cy={18.5} r={2.3} />
      <Circle cx={17} cy={9} r={2.3} />
      <Path d="M7 7.8v8.4" />
      <Path d="M17 11.3c0 3.4-3 4.2-6.4 4.8" />
    </G>
  ),
  // A burst.
  fireworks: ({ color }) => (
    <G stroke={color} strokeWidth={1.9} strokeLinecap="round">
      {[0, 45, 90, 135].map((angle) => (
        <Path key={angle} d="M12 4.5V19.5" transform={`rotate(${angle} 12 12)`} />
      ))}
    </G>
  ),
  // Linked rings.
  together: ({ color }) => (
    <G stroke={color} strokeWidth={1.8} fill="none">
      <Circle cx={8.5} cy={8.5} r={4.6} />
      <Circle cx={15.5} cy={15.5} r={4.6} />
    </G>
  ),
  // A triangle.
  vercel: ({ color }) => <Path d="M12 4 21.5 20h-19L12 4Z" fill={color} />,
  // Layers, for a mixture of agents.
  moa: ({ color }) => (
    <G stroke={color} strokeWidth={1.7} strokeLinejoin="round" fill="none">
      <Path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
      <Path d="M3 12.5 12 17l9-4.5" />
      <Path d="M3 16.5 12 21l9-4.5" />
    </G>
  ),
};

/** Canonical vendor key for a Hermes provider slug, or null when unknown. */
export function vendorFor(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  for (const [pattern, vendor] of ALIASES) {
    if (pattern.test(normalized)) return vendor;
  }
  return null;
}

export function ProviderMark({
  slug,
  size = MARK_SIZE,
}: {
  slug: string;
  /** Display name, used only for the initial when the vendor is unknown. */
  name?: string;
  size?: number;
}) {
  const vendor = vendorFor(slug);
  const glyph = vendor ? MARKS[vendor] : undefined;
  const tint = (vendor && TINTS[vendor]) || colors.ink2;

  if (!glyph) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 3 }]}>
        <Text style={styles.fallbackText}>{initialFor(slug)}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {glyph({ color: tint })}
      </Svg>
    </View>
  );
}

function initialFor(slug: string): string {
  const letter = slug.trim()[0];
  return letter ? letter.toUpperCase() : '?';
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  fallbackText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
});
