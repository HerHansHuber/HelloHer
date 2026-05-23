import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EXAMPLE_PATTERNS, validateSiteswap } from './juggling/siteswap.js';
import { JugglingScene } from './visualizer/JugglingScene.jsx';
import './styles.css';

function App() {
  const [pattern, setPattern] = useState('531');
  const [speed, setSpeed] = useState(1.05);
  const [showTrails, setShowTrails] = useState(true);
  const [showGizmos, setShowGizmos] = useState(true);
  const [personCount, setPersonCount] = useState(1);
  const [passing, setPassing] = useState(false);
  const [passThreshold, setPassThreshold] = useState(5);
  const [paused, setPaused] = useState(false);
  const validation = useMemo(() => validateSiteswap(pattern), [pattern]);
  const selectedPreset = EXAMPLE_PATTERNS.find((item) => item.siteswap === pattern);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">React + Three.js</p>
          <h1>HelloHer Juggling Lab</h1>
          <p className="lede">
            A browser-based siteswap visualizer inspired by JugglingLab: enter a juggling pattern,
            validate its landing logic, and watch the throws orbit through 3D space.
          </p>
        </div>
        <div className="pattern-card">
          <span className="label">Current pattern</span>
          <strong>{pattern || '—'}</strong>
          <span className={validation.valid ? 'status good' : 'status bad'}>{validation.reason}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="controls-panel">
          <label className="control-block">
            <span>Choose a preset</span>
            <select value={selectedPreset?.siteswap ?? ''} onChange={(event) => setPattern(event.target.value)}>
              <option value="" disabled>Pick a pattern…</option>
              {EXAMPLE_PATTERNS.map((item) => (
                <option key={item.name} value={item.siteswap}>{item.name} — {item.siteswap}</option>
              ))}
            </select>
          </label>

          <label className="control-block">
            <span>Custom siteswap</span>
            <input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="e.g. 3, 441, 531, 97531"
              spellCheck="false"
            />
          </label>

          <label className="control-block">
            <span>Animation speed: {speed.toFixed(2)}x</span>
            <input
              type="range"
              min="0.35"
              max="2.25"
              step="0.05"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>

          <label className="control-block">
            <span>Jugglers: {personCount}</span>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={personCount}
              onChange={(event) => setPersonCount(Number(event.target.value))}
            />
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={passing}
              onChange={(event) => setPassing(event.target.checked)}
            />
            <span>Passing mode: high throws go to the next person</span>
          </label>

          <label className="control-block compact-control">
            <span>Pass threshold: throws ≥ {passThreshold}</span>
            <input
              type="range"
              min="3"
              max="9"
              step="1"
              value={passThreshold}
              onChange={(event) => setPassThreshold(Number(event.target.value))}
            />
          </label>

          <div className="button-row three-buttons">
            <button onClick={() => setPaused((value) => !value)}>{paused ? 'Resume' : 'Pause'}</button>
            <button className="ghost" onClick={() => setShowTrails((value) => !value)}>
              {showTrails ? 'Hide arcs' : 'Show arcs'}
            </button>
            <button className="ghost" onClick={() => setShowGizmos((value) => !value)}>
              {showGizmos ? 'Hide gizmos' : 'Show gizmos'}
            </button>
          </div>

          <div className="info-grid">
            <div><span>Balls</span><strong>{validation.valid ? validation.balls * personCount : '—'}</strong></div>
            <div><span>Jugglers</span><strong>{personCount}</strong></div>
            <div><span>Period</span><strong>{validation.valid ? validation.period : '—'}</strong></div>
            <div><span>Mode</span><strong>{passing && personCount > 1 ? 'Passing' : 'Solo'}</strong></div>
            <div><span>Throws</span><strong>{validation.throws?.join(' · ') || '—'}</strong></div>
          </div>

          <div className="note">
            <strong>Notation:</strong> digits are throw heights; letters continue above 9 (<code>a = 10</code>).
            Passing mode duplicates the pattern across jugglers and sends throws at/above the threshold to the next person.
          </div>
        </aside>

        <section className="stage-card">
          <JugglingScene
            pattern={pattern}
            speed={speed}
            paused={paused}
            showTrails={showTrails}
            showGizmos={showGizmos}
            personCount={personCount}
            passing={passing}
            passThreshold={passThreshold}
          />
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
