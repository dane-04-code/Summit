import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, font } from "./theme";

export const TitleCard: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame, fps, config: { damping: 200 } });
  const subtitleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 600,
          color: colors.ink,
          letterSpacing: -2,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 20}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 34,
          color: colors.muted,
          opacity: subtitleOpacity,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
