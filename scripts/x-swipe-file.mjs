#!/usr/bin/env node
// Stage 1 (research) for docs/launch-advice/x-trending-guide.md.
// Pulls recent posts for each account in x-swipe-file-accounts.json via twitterapi.io,
// keeps only posts that beat that account's own average views, and writes a ranked
// swipe file to docs/launch-advice/swipe-file.md.
//
// Requires: TWITTERAPI_KEY env var (https://twitterapi.io — sign up, copy the key).
// Usage: node scripts/x-swipe-file.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCOUNTS_PATH = path.join(__dirname, "x-swipe-file-accounts.json");
const OUTPUT_PATH = path.join(__dirname, "..", "docs", "launch-advice", "swipe-file.md");
const API_BASE = "https://api.twitterapi.io/twitter/user/last_tweets";
const TWEETS_PER_ACCOUNT = 40;

function apiKey() {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) {
    console.error("Missing TWITTERAPI_KEY. Sign up at https://twitterapi.io, then run:");
    console.error('  TWITTERAPI_KEY=your-key node scripts/x-swipe-file.mjs');
    process.exit(1);
  }
  return key;
}

async function fetchTweets(userName, key) {
  const tweets = [];
  let cursor = "";
  while (tweets.length < TWEETS_PER_ACCOUNT) {
    const url = new URL(API_BASE);
    url.searchParams.set("userName", userName);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { "X-API-Key": key } });
    if (!res.ok) {
      console.warn(`  [${userName}] request failed: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json();
    const page = data.tweets ?? [];
    tweets.push(...page);
    if (!data.has_next_page || !data.next_cursor || page.length === 0) break;
    cursor = data.next_cursor;
  }
  return tweets.slice(0, TWEETS_PER_ACCOUNT);
}

function aboveAverage(tweets) {
  if (tweets.length === 0) return [];
  const avgViews = tweets.reduce((sum, t) => sum + (t.viewCount ?? 0), 0) / tweets.length;
  return tweets
    .filter((t) => (t.viewCount ?? 0) > avgViews)
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
}

function renderEntry(handle, name, note, winners, avgViews) {
  const lines = [`## @${handle} — ${name}`, "", note ? `_${note}_` : "", ""];
  lines.push(`Account average views (last ${TWEETS_PER_ACCOUNT} posts): ${Math.round(avgViews).toLocaleString()}`, "");
  if (winners.length === 0) {
    lines.push("_No above-average posts found (or fetch failed — check the handle/API status)._", "");
    return lines.join("\n");
  }
  for (const t of winners) {
    lines.push(`### ${(t.viewCount ?? 0).toLocaleString()} views — ${t.url ?? ""}`);
    lines.push("");
    lines.push((t.text ?? "").trim());
    lines.push("");
    lines.push(
      `likes ${t.likeCount ?? 0} · replies ${t.replyCount ?? 0} · reposts ${t.retweetCount ?? 0} · quotes ${t.quoteCount ?? 0}`
    );
    lines.push("");
    lines.push("**Why it worked:** _(fill in after reading — hook type, format, claim)_");
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const key = apiKey();
  const raw = await readFile(ACCOUNTS_PATH, "utf-8");
  const accounts = JSON.parse(raw);

  const allHandles = Object.values(accounts)
    .flatMap((v) => (Array.isArray(v) ? v : []))
    .filter((entry) => entry.handle && entry.handle !== "needs_handle");

  if (allHandles.length === 0) {
    console.error("No confirmed handles in x-swipe-file-accounts.json yet — add some before running.");
    process.exit(1);
  }

  const sections = [];
  for (const { handle, name, note } of allHandles) {
    console.log(`Fetching @${handle}...`);
    const tweets = await fetchTweets(handle, key);
    const avgViews = tweets.length
      ? tweets.reduce((sum, t) => sum + (t.viewCount ?? 0), 0) / tweets.length
      : 0;
    const winners = aboveAverage(tweets);
    sections.push(renderEntry(handle, name, note, winners, avgViews));
  }

  const doc = [
    "# Swipe File — Self-Hosted Agent / Hermes / OpenClaw Niche",
    "",
    `Generated ${new Date().toISOString().slice(0, 10)} by scripts/x-swipe-file.mjs. Ranked by views within each account (posts beating that account's own average). Fill in "Why it worked" for each entry before using this to write launch copy.`,
    "",
    "---",
    "",
    sections.join("\n---\n\n"),
  ].join("\n");

  await writeFile(OUTPUT_PATH, doc, "utf-8");
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main();
