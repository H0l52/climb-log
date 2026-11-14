import { describe, expect, it } from 'vitest';
import { appHeight } from './viewport';

// iPhone 13: 390 × 844 CSS px, status bar 47 px.
const phone = { screenWidth: 390, screenHeight: 844, innerWidth: 390 };

describe('appHeight', () => {
  it('uses the full screen height when standalone launches with a short viewport', () => {
    expect(appHeight({ ...phone, standalone: true, innerHeight: 844 - 47 })).toBe(844);
  });

  it('keeps the reported height once the viewport is correct', () => {
    expect(appHeight({ ...phone, standalone: true, innerHeight: 844 })).toBe(844);
  });

  it('never shrinks below the reported height', () => {
    expect(appHeight({ ...phone, standalone: true, innerHeight: 900 })).toBe(900);
  });

  it('trusts the window in a browser tab, where toolbars take space', () => {
    expect(appHeight({ ...phone, standalone: false, innerHeight: 664 })).toBe(664);
  });

  it('trusts the window in landscape', () => {
    expect(appHeight({ ...phone, standalone: true, innerWidth: 844, innerHeight: 390 })).toBe(390);
  });
});
