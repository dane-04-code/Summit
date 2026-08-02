import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, font } from "./theme";

export const EndCard: React.FC<{ cta: string }> = ({ cta }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
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
        opacity,
      }}
    >
      <div style={{ fontSize: 80, fontWeight: 600, color: colors.ink, letterSpacing: -2 }}>
        Summit
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 32,
          color: colors.accent,
          fontWeight: 500,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};
