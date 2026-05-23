import { describe, expect, it } from 'vitest';
import {
  BALL_MATERIALS,
  RENDER_FEATURES,
  getMaterialOption,
  normalizeRenderFeatures,
} from './materialOptions.js';

describe('visual material/render options', () => {
  it('offers all requested ball material choices', () => {
    expect(BALL_MATERIALS.map((material) => material.id)).toEqual([
      'glass',
      'steel',
      'wood',
      'fire',
      'baseball',
      'cotton',
      'custom',
    ]);
  });

  it('offers optional beauty render features as checkboxes', () => {
    expect(RENDER_FEATURES.map((feature) => feature.id)).toEqual([
      'caustics',
      'shadows',
      'reflection',
      'refraction',
      'environmentMap',
    ]);
  });

  it('falls back to glass for unknown material ids', () => {
    expect(getMaterialOption('wat')).toMatchObject({ id: 'glass', label: 'Glass' });
  });

  it('normalizes render feature toggles with shadows and env map enabled by default', () => {
    expect(normalizeRenderFeatures({ caustics: true, refraction: true })).toEqual({
      caustics: true,
      shadows: true,
      reflection: false,
      refraction: true,
      environmentMap: true,
    });
  });
});
