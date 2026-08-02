import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, font } from "./theme";

// Preview-only stand-in for ScreenClip, used before real screen recordings
// exist. Same layout/timing as the real beat, just a labeled placeholder
// box instead of <OffthreadVideo>. Not used in the real render pipeline.
export const PlaceholderClip: React.FC<{
  label: string;
  caption: string;
  durationInFrames: number;
}> = ({ label, caption, durationInFrames }) => {
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
          backgroundColor: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: colors.muted,
            fontSize: 30,
            textAlign: "center",
            padding: 40,
            border: `2px dashed ${colors.line}`,
            borderRadius: 24,
          }}
        >
          {label}
          <div style={{ fontSize: 20, marginTop: 12, color: colors.accent }}>
            [screen recording placeholder]
          </div>
        </div>
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
