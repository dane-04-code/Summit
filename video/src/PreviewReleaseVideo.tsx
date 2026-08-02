import { AbsoluteFill, Sequence } from "remotion";
import { TitleCard } from "./TitleCard";
import { PlaceholderClip } from "./PlaceholderClip";
import { EndCard } from "./EndCard";

const FPS = 30;
const TITLE = 3 * FPS;
const CLIP_1 = 5 * FPS;
const CLIP_2 = 5 * FPS;
const CLIP_3 = 5 * FPS;
const END = 4 * FPS;

export const previewDurationInFrames = TITLE + CLIP_1 + CLIP_2 + CLIP_3 + END;

// Same pacing as ReleaseVideo.tsx, with placeholder boxes standing in for
// the real screen recordings — lets you preview timing/style before footage
// is recorded. Delete once real clips exist and ReleaseVideo is final.
export const PreviewReleaseVideo: React.FC = () => {
  let cursor = 0;
  const titleFrom = cursor;
  cursor += TITLE;
  const clip1From = cursor;
  cursor += CLIP_1;
  const clip2From = cursor;
  cursor += CLIP_2;
  const clip3From = cursor;
  cursor += CLIP_3;
  const endFrom = cursor;

  return (
    <AbsoluteFill>
      <Sequence from={titleFrom} durationInFrames={TITLE}>
        <TitleCard
          title="Summit"
          subtitle="The mobile cockpit for your self-hosted agent"
        />
      </Sequence>

      <Sequence from={clip1From} durationInFrames={CLIP_1}>
        <PlaceholderClip
          label="Pairing flow"
          caption="Pair in seconds — no dashboard required"
          durationInFrames={CLIP_1}
        />
      </Sequence>

      <Sequence from={clip2From} durationInFrames={CLIP_2}>
        <PlaceholderClip
          label="Chat / streamed output"
          caption="Stream clean, readable output — from anywhere"
          durationInFrames={CLIP_2}
        />
      </Sequence>

      <Sequence from={clip3From} durationInFrames={CLIP_3}>
        <PlaceholderClip
          label="Approve / stop a run"
          caption="Approve or stop a run right from your phone"
          durationInFrames={CLIP_3}
        />
      </Sequence>

      <Sequence from={endFrom} durationInFrames={END}>
        <EndCard cta="Coming soon" />
      </Sequence>
    </AbsoluteFill>
  );
};
