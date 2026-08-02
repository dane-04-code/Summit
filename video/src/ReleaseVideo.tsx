import { AbsoluteFill, Sequence } from "remotion";
import { TitleCard } from "./TitleCard";
import { ScreenClip } from "./ScreenClip";
import { EndCard } from "./EndCard";

const FPS = 30;

// Beat timings (frames). Adjust once real clips are recorded and you know
// the actual pacing you want — these are a reasonable starting draft for a
// ~24s vertical social teaser.
const TITLE = 3 * FPS; // 0:00–0:03
const CLIP_1 = 5 * FPS; // 0:03–0:08
const CLIP_2 = 5 * FPS; // 0:08–0:13
const CLIP_3 = 5 * FPS; // 0:13–0:18
const END = 4 * FPS; // 0:18–0:22

export const durationInFrames = TITLE + CLIP_1 + CLIP_2 + CLIP_3 + END;

export const ReleaseVideo: React.FC = () => {
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
        <ScreenClip
          src="clips/01-pair.mp4"
          caption="Pair in seconds — no dashboard required"
          durationInFrames={CLIP_1}
        />
      </Sequence>

      <Sequence from={clip2From} durationInFrames={CLIP_2}>
        <ScreenClip
          src="clips/02-chat.mp4"
          caption="Stream clean, readable output — from anywhere"
          durationInFrames={CLIP_2}
        />
      </Sequence>

      <Sequence from={clip3From} durationInFrames={CLIP_3}>
        <ScreenClip
          src="clips/03-approve.mp4"
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
