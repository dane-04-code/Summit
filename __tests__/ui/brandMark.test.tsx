import React from 'react';
import { render } from '@testing-library/react-native';

import { BrandMark, PeakGlyph } from '@/ui/BrandMark';

it('renders the brand tile with the peak glyph', async () => {
  const result = await render(<BrandMark />);
  expect(result.toJSON()).not.toBeNull();
});

it('renders the standalone glyph', async () => {
  const result = await render(<PeakGlyph size={64} />);
  expect(result.toJSON()).not.toBeNull();
});
