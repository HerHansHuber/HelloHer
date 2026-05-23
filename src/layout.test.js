import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('viewport layout', () => {
  it('pins the app to the browser window without page-level scrolling', () => {
    expect(css).toMatch(/html,\s*body,\s*#root\s*\{[^}]*height:\s*100%/s);
    expect(css).toMatch(/body\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*width:\s*100vw[^}]*height:\s*100dvh[^}]*margin:\s*0/s);
  });

  it('keeps the menu hard-left and gives remaining height to the scene', () => {
    expect(css).toMatch(/\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(280px,\s*340px\)\s+minmax\(0,\s*1fr\)[^}]*height:\s*100%/s);
    expect(css).toMatch(/\.controls-panel\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.stage-card\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.three-mount\s*\{[^}]*min-height:\s*0/s);
  });
});
