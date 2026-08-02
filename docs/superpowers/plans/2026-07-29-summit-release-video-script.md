# Summit release video — script

Date: 2026-07-29

Goal: a release/teaser video for Summit built to perform on X — catchy,
beat-driven, "popping component" style (Arc/Raycast/Linear-style launch
videos), not a plain app-feature walkthrough. This is the locked script;
build (Remotion) starts from this.

## Format

- 9:16 vertical, ~13s of motion + hold (~18-20s total with the closing hold)
- Cut to a generic hard-beat tech track, 128 BPM (~0.47s/beat) — every pop and
  cut lands on the beat grid, not floating freely
- Phone-screen beats are **fully animated mockups**, not real screen
  recordings — keeps the motion style consistent with the logo-reveal
  section (real footage reads flat/slow next to spring-animated logo work)

## Beat-by-beat

| Beat | Time | Scene | On-screen text | Motion note |
|---|---|---|---|---|
| 1 | 0:00.00 | Black, single point of light | — | Pulse hits on beat 1 |
| 3 | 0:00.94 | Point snap-scales into Summit mark, slight overshoot | — | Land the overshoot's settle on beat 3, not the initial pop — makes it feel weighted |
| 5–6 | 0:01.88–2.35 | Summit mark ejects two smaller marks on arcs | — | Eject on beat 5, arc peak on beat 6 |
| 7 | 0:02.82 | Hermes logo snaps into orbit position (squash-stretch) | — | Hard snap exactly on beat 7 |
| 8 | 0:03.29 | OpenClaw logo snaps into orbit position | — | Same snap, one beat later than Hermes — reads as sequential, not simultaneous/cluttered |
| 9–10 | 0:03.76–4.23 | All three lock into a row | "One app. Any agent." | Text pops in on beat 9, holds through 10 |
| 11–12 | 0:04.70–5.17 | Row collapses — Hermes/OpenClaw shrink back into Summit mark | — | Collapse starts beat 11, snap-settle on 12 |
| 13 | 0:05.64 | Hard cut to phone screen 1 | — | Cuts always land on a downbeat, never mid-beat |
| 13–16 | 0:05.64–7.51 | Message bubble pops in, markdown renders line-by-line (staggered ~1/8 beat per line) | "Read everything, clearly." | The "busy" texture beat — line-pops are subdivisions, not full beats |
| 17 | 0:07.98 | Hard cut to phone screen 2 | — | |
| 17–20 | 0:07.98–9.85 | Approval card slides up, snaps into place, tap → checkmark pop | "Approve. Stop. From your pocket." | Checkmark pop is the loudest hit in the whole edit — land it dead-center on beat 19 |
| 21 | 0:09.85 | Hard cut to phone screen 3 | — | |
| 21–22 | 0:09.85–10.32 | Push notification drops in, pops, dismisses | "It finds you." | Fastest beat in the video, on purpose — one full cut in under half a second |
| 23 | 0:10.79 | Cut to black | — | |
| 24–27 | 0:11.26–12.67 | Summit wordmark snap-fades in, holds | "Summit — launching soon on iOS & Android" | App Store + Google Play marks appear small beneath the wordmark on beat 26 — a beat after the wordmark, so they read as a footnote, not competing with the name |

## Decisions locked in

- **Hermes/OpenClaw logos**: they orbit in and get absorbed back into the
  Summit mark (reads as "Summit unifies them"). Flagged once that this could
  read as affiliation/endorsement rather than "connects to" — user chose to
  keep it as scripted.
- **Audio**: generic hard-beat tech track, not a specific licensed track —
  timing above is built around a standard 128 BPM grid so it'll re-time
  cleanly to most stock synth/percussion tracks in this genre.
- **Phone screens**: fully animated mockups, not real screen recordings.
- **Closer/CTA**: no waitlist link — app isn't live in stores yet, so the
  closer is a launch-availability line ("launching soon on iOS & Android")
  with store marks, not a link or handle.

## Not done yet / superseded

An earlier first-pass build exists at `video/` (Remotion project) using a
different structure — title card → 3 real-screen-recording beats → end card,
no logo reveal. That build does **not** match this script and was explicitly
called "not right" by the user. Treat `video/src/ReleaseVideo.tsx` and
`video/src/PreviewReleaseVideo.tsx` as stale scaffolding to be replaced when
building against this script, not as a base to extend.
