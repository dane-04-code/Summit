# Summit release video

A 9:16 (1080x1920) release/teaser video for Summit, built with Remotion. Real
iOS screen recordings + programmatic titles/captions — no stylized/animated
mockups.

## Structure (`src/ReleaseVideo.tsx`)

| Beat | Time | What |
|---|---|---|
| Title card | 0:00–0:03 | "Summit" + tagline |
| Clip 1 | 0:03–0:08 | `public/clips/01-pair.mp4` — pairing flow |
| Clip 2 | 0:08–0:13 | `public/clips/02-chat.mp4` — chat / streamed markdown output |
| Clip 3 | 0:13–0:18 | `public/clips/03-approve.mp4` — approving/stopping a run from the phone |
| End card | 0:18–0:22 | "Summit" + CTA |

Each beat is a `<Sequence>` in `ReleaseVideo.tsx` — reorder, retime, or add more
by editing the frame constants at the top of that file.

## Recording the clips

Record on a real device or the iOS Simulator (Simulator > File > Record
Screen media, then `xcrun simctl io booted recordVideo out.mov`, or QuickTime
Player > File > New Movie Recording with the simulator window selected).

- Portrait, no simulator chrome/bezel — crop to just the app content.
- 5–8s per clip, one clear action per clip (don't try to show two features in
  one clip).
- Convert to mp4 if needed: `ffmpeg -i out.mov -c:v libx264 -pix_fmt yuv420p 01-pair.mp4`
- Drop the three files into `public/clips/` using the exact names above (or
  update the `src` props in `ReleaseVideo.tsx` if you name them differently).

`OffthreadVideo` in `ScreenClip.tsx` crops each clip to a phone-frame box
(`object-fit: cover`), so extra headroom in the recording is fine — frame the
shot a bit wide rather than tight.

## Commands

```console
npm i
npm run dev        # Remotion Studio — live preview, scrub the timeline
npx remotion render src/index.ts SummitRelease out/summit-release.mp4
```

Render defaults to 1080x1920 @ 30fps per the composition in
`src/Composition.tsx`. For a landscape/square crop for other platforms, add a
second `<Composition>` with different `width`/`height` reusing `ReleaseVideo`.

## Captions / copy

Caption text lives inline in `ReleaseVideo.tsx` (one line per clip) and in
`TitleCard`/`EndCard` props — edit those directly rather than adding a data
layer; this is a one-off, not a template for batch rendering.

Voice: calm, technical, direct — see `../BRANDING.md`. Avoid hype language
("revolutionary", "game-changing"); Summit's audience is technical
self-hosters who respond to precision, not hype.
