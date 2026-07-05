import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/theme';

export function EyeIcon({ off }: { off?: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z"
        stroke={colors.muted}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx={10} cy={10} r={2.2} stroke={colors.muted} strokeWidth={1.5} />
      {off ? (
        <Path d="M4 4 16 16" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

export function AppleLogo() {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20" fill="none">
      <Path
        d="M14 14.7c-.3.7-.5 1-.9 1.6-.6.9-1.4 2-2.5 2-.9 0-1.2-.6-2.4-.6s-1.5.6-2.4.6c-1.1 0-1.8-1-2.4-1.9C1.6 14.4.9 11 2.1 8.7c.7-1.3 1.9-2.1 3-2.1 1.1 0 1.8.6 2.7.6.9 0 1.4-.6 2.7-.6 1 0 2 .5 2.7 1.4-2.4 1.3-2 4.7.8 6.3ZM10.3 4.4c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.8 2.5.9.1 1.8-.5 2.4-1.2Z"
        fill={colors.ink}
      />
    </Svg>
  );
}
