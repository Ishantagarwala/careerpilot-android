import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { Tag } from './Tag';

/**
 * Component render tests.
 *
 * These exist because a component can typecheck and still throw on first
 * render — bad hook order, an undefined style key, a missing provider. Without
 * a device that class of bug is otherwise invisible, and this is the supported
 * way to catch it under Node.
 *
 * NOTE: `render` is ASYNC in @testing-library/react-native v14. It must be
 * awaited, otherwise nothing is mounted and every query fails with "`render`
 * function has not been called" — which reads like a mock problem and is not.
 */

describe('Tag', () => {
  it('renders its label', async () => {
    await render(<Tag>Beginner</Tag>);
    expect(screen.getByText('Beginner')).toBeTruthy();
  });

  it('carries the label as accessible text, not only as colour', async () => {
    // DESIGN_SPEC §7: colour must never be the only signal. The tone changes
    // the fill; the meaning must still be readable as text.
    await render(<Tag tone="lime">Complete</Tag>);
    expect(screen.getByText('Complete')).toBeTruthy();
  });

  it('renders every tone without throwing', async () => {
    const tones = ['outline', 'lime', 'dark', 'danger'] as const;
    for (const tone of tones) {
      await render(<Tag tone={tone}>{tone}</Tag>);
      expect(screen.getByText(tone)).toBeTruthy();
    }
  });

  it('truncates to a single line rather than wrapping', async () => {
    // Chips sit in rows; a wrapping chip breaks the row height.
    await render(<Tag>a very long tag label that should not wrap</Tag>);
    const node = screen.getByText('a very long tag label that should not wrap');
    expect(node.props.numberOfLines).toBe(1);
  });
});
