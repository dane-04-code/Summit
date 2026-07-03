/**
 * Real-world / pathological markdown shapes for exercising the RichMarkdown
 * renderer (Pass 4 — Rich Output Polish). These are the exact things Hermes is
 * likely to send that historically break mobile markdown: wide tables, deep
 * nesting, unbreakable tokens, long code lines, and oversized responses.
 */

/** 6 columns with long-ish cells — overflows a phone width, must scroll. */
export const WIDE_TABLE = `| Symbol | Side | Quantity | Entry Price | Stop Loss | Take Profit |
|--------|------|----------|-------------|-----------|-------------|
| BTCUSDT | long | 0.0125 | 64,215.40 | 61,900.00 | 71,850.00 |
| ETHUSDT | short | 3.20 | 3,410.88 | 3,560.10 | 2,980.25 |
| SOLUSDT | long | 42.75 | 148.20 | 139.90 | 172.60 |`;

/** Deeply nested bullets plus a nested ordered list. */
export const NESTED_LIST = `- Top level
  - Second level
    - Third level
      - Fourth level with a longer sentence that wraps on a narrow screen
- Back to top
  1. Ordered child
  2. Another ordered child
     - Bullet under ordered
     - Second bullet`;

/** A very long unbreakable token (a URL) that can push layout off-screen. */
export const LONG_UNBREAKABLE = `Here is a link with no break points:

https://example.com/very/long/path/that/keeps/going/${'segment-'.repeat(30)}end?token=${'a'.repeat(120)}`;

/** A long code fence line — the CodeBlock must scroll it horizontally. */
export const WIDE_CODE = `\`\`\`python
result = compute(${Array.from({ length: 40 }, (_, i) => `argument_number_${i}=${i}`).join(', ')})
\`\`\``;

/** Everything at once — the "screen-record" case. */
export const MIXED_DOC = `# Portfolio Review

Here's the **current state** and what I'd change.

## Open positions

${WIDE_TABLE}

## Reasoning

- Momentum is fading on \`ETHUSDT\`
  - RSI divergence on the 4h
  - Volume down 18% week-over-week
- \`SOLUSDT\` still has room

\`\`\`python
def rebalance(book):
    return [p for p in book if p.edge > 0.02]
\`\`\`

> Risk note: keep total exposure under 3% of equity.

## Next steps

- [x] Close the ETH short
- [ ] Scale into SOL
- [!] Wait for BTC to reclaim 65k

See the [full write-up](https://example.com/notes) and the [runbook](https://example.com/runbook).`;

/** Builds an oversized response (exceeds the renderer's line/char caps). */
export function makeHugeDoc(): string {
  const para = 'This is a long paragraph of agent output that repeats. ';
  return Array.from({ length: 2500 }, (_, i) => `Line ${i}: ${para}`).join('\n');
}

export const ALL_FIXTURES: Record<string, string> = {
  WIDE_TABLE,
  NESTED_LIST,
  LONG_UNBREAKABLE,
  WIDE_CODE,
  MIXED_DOC,
};
