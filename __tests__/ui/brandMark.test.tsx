import React from 'react';
import { render } from '@testing-library/react-native';

import { BrandMark, MARK_ASPECT } from '@/ui/BrandMark';

it('renders the Summit mark', async () => {
  const result = await render(<BrandMark />);
  expect(result.getByLabelText('Summit')).toBeTruthy();
});

it('sizes the mark from its intrinsic aspect', async () => {
  const result = await render(<BrandMark width={152} />);
  expect(result.getByLabelText('Summit')).toHaveStyle({
    width: 152,
    height: Math.round(152 / MARK_ASPECT),
  });
});
