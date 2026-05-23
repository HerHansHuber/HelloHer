import { describe, expect, it } from 'vitest';
import {
  parseSiteswap,
  validateSiteswap,
  getThrowPosition,
  samplePatternState,
  EXAMPLE_PATTERNS,
} from './siteswap.js';

describe('siteswap pattern logic', () => {
  it('parses digit and letter throw heights like JugglingLab-style notation', () => {
    expect(parseSiteswap('531')).toEqual([5, 3, 1]);
    expect(parseSiteswap('a31')).toEqual([10, 3, 1]);
  });

  it('calculates ball counts for valid asynchronous siteswaps', () => {
    expect(validateSiteswap('3')).toMatchObject({ valid: true, balls: 3, period: 1 });
    expect(validateSiteswap('441')).toMatchObject({ valid: true, balls: 3, period: 3 });
    expect(validateSiteswap('97531')).toMatchObject({ valid: true, balls: 5, period: 5 });
  });

  it('rejects malformed or collision-heavy patterns', () => {
    expect(validateSiteswap('')).toMatchObject({ valid: false });
    expect(validateSiteswap('32')).toMatchObject({ valid: false });
    expect(validateSiteswap('abc!')).toMatchObject({ valid: false });
  });

  it('maps throws to alternating hands and smooth parabolic paths', () => {
    const start = getThrowPosition(0, 3, 0);
    const apex = getThrowPosition(0, 3, 0.5);
    const end = getThrowPosition(0, 3, 1);
    expect(start.x).toBeLessThan(0);
    expect(end.x).toBeGreaterThan(0);
    expect(apex.y).toBeGreaterThan(start.y);
    expect(apex.y).toBeGreaterThan(end.y);
  });

  it('samples one visible ball per non-zero throw currently in flight', () => {
    const state = samplePatternState('441', 3.4);
    expect(state.balls.length).toBeGreaterThan(0);
    expect(state.balls.every((ball) => ball.height > 0)).toBe(true);
  });

  it('ships with ready-to-try pattern presets', () => {
    expect(EXAMPLE_PATTERNS.length).toBeGreaterThanOrEqual(8);
    expect(EXAMPLE_PATTERNS.every((pattern) => validateSiteswap(pattern.siteswap).valid)).toBe(true);
  });
});
