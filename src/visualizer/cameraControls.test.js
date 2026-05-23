import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sceneSource = readFileSync(new URL('./JugglingScene.jsx', import.meta.url), 'utf8');

describe('camera interaction controls', () => {
  it('uses OrbitControls for rotate, zoom and pan gestures', () => {
    expect(sceneSource).toContain("OrbitControls");
    expect(sceneSource).toMatch(/new OrbitControls\(camera,\s*renderer\.domElement\)/);
    expect(sceneSource).toMatch(/controls\.enableDamping\s*=\s*true/);
    expect(sceneSource).toMatch(/controls\.enablePan\s*=\s*true/);
    expect(sceneSource).toMatch(/controls\.enableZoom\s*=\s*true/);
    expect(sceneSource).toMatch(/controls\.mouseButtons\s*=\s*\{/);
    expect(sceneSource).toMatch(/controls\.update\(\)/);
    expect(sceneSource).toMatch(/controls\.dispose\(\)/);
  });

  it('does not overwrite the user camera with an automatic orbit animation', () => {
    expect(sceneSource).not.toMatch(/camera\.position\.x\s*=\s*Math\.sin/);
  });

  it('adds visible scene control gizmos for axes, target and orbit radius', () => {
    expect(sceneSource).toMatch(/createSceneControlGizmos/);
    expect(sceneSource).toMatch(/new THREE\.ArrowHelper/);
    expect(sceneSource).toMatch(/new THREE\.TorusGeometry/);
    expect(sceneSource).toMatch(/sceneControlGizmos\.visible\s*=\s*state\.showGizmos/);
  });
});
