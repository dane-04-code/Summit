import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  useCurrentFrame,
} from "remotion";
import { colors, font } from "./theme";

// One beat: a real screen recording (public/clips/*.mp4) in a phone frame,
// with a one-line caption underneath. Caption fades/slides in, clip fades out
// at the end of its slot so the cut to the next beat is clean.
export const ScreenClip: React.FC<{
  src: string;
  caption: string;
  durationInFrames: number;
}> = ({ src, caption, durationInFrames }) => {
  const frame = useCurrentFrame();

  const captionOpacity = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outOpacity = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        opacity: outOpacity,
      }}
    >
      <div
        style={{
          width: 900,
          height: 1300,
          borderRadius: 48,
          overflow: "hidden",
          border: `2px solid ${colors.line}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.5)",
        }}
      >
        <OffthreadVideo src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 38,
          fontWeight: 500,
          color: colors.ink,
          opacity: captionOpacity,
          textAlign: "center",
          maxWidth: 860,
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
};
