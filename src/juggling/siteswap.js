export const EXAMPLE_PATTERNS = [
  { name: '3-ball Cascade', siteswap: '3', description: 'The classic alternating three-ball cascade.' },
  { name: '3-ball Fountain/Cross', siteswap: '441', description: 'Two high throws and a quick zip.' },
  { name: 'Box', siteswap: '423', description: 'A clean box-inspired asynchronous pattern.' },
  { name: 'Shower', siteswap: '51', description: 'High throws in one direction with quick passes.' },
  { name: 'Mills Mess Seed', siteswap: '531', description: 'A common base rhythm for 3-ball variations.' },
  { name: '4-ball Fountain', siteswap: '4', description: 'Even throws return to the same hand.' },
  { name: '5-ball Cascade', siteswap: '5', description: 'Higher odd throws crossing between hands.' },
  { name: '5-ball Snake', siteswap: '97531', description: 'A dramatic five-ball siteswap wave.' },
  { name: 'High 5-ball', siteswap: '744', description: 'A tall five-ball pattern with same-hand holds.' },
];

const HAND_SPACING = 2.25;
const BASE_Y = 0.72;
const HAND_Y = 0.42;
const DEPTH_STEP = 0.18;

export function throwCharToHeight(char) {
  if (/^[0-9]$/.test(char)) return Number(char);
  if (/^[a-z]$/i.test(char)) return char.toLowerCase().charCodeAt(0) - 87; // a=10
  return Number.NaN;
}

export function parseSiteswap(input) {
  if (typeof input !== 'string') return [];
  const compact = input.trim().replace(/\s+/g, '').toLowerCase();
  if (!compact) return [];
  return [...compact].map(throwCharToHeight);
}

export function validateSiteswap(input) {
  const throws = parseSiteswap(input);
  const compact = typeof input === 'string' ? input.trim().replace(/\s+/g, '') : '';

  if (!compact) {
    return { valid: false, reason: 'Enter a pattern like 3, 441, 531, 744, or 97531.', throws: [], balls: 0, period: 0 };
  }

  if (throws.some((height) => !Number.isInteger(height) || height < 0)) {
    return { valid: false, reason: 'Use digits 0-9 or letters a-z for heights 10+.', throws, balls: 0, period: throws.length };
  }

  const period = throws.length;
  const sum = throws.reduce((acc, height) => acc + height, 0);
  const balls = sum / period;
  if (!Number.isInteger(balls)) {
    return { valid: false, reason: `Average throw height is ${balls.toFixed(2)}, not a whole number of balls.`, throws, balls, period };
  }

  const landings = new Map();
  for (let beat = 0; beat < period; beat += 1) {
    const height = throws[beat];
    if (height === 0) continue;
    const landing = (beat + height) % period;
    if (landings.has(landing)) {
      return {
        valid: false,
        reason: `Collision: beats ${landings.get(landing) + 1} and ${beat + 1} both land on slot ${landing + 1}.`,
        throws,
        balls,
        period,
      };
    }
    landings.set(landing, beat);
  }

  return { valid: true, reason: `${balls}-ball pattern, period ${period}.`, throws, balls, period };
}

export function handForBeat(beat) {
  return beat % 2 === 0 ? -1 : 1;
}

export function getThrowPosition(startBeat, height, progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const startHand = handForBeat(startBeat);
  const crosses = height % 2 === 1;
  const endHand = crosses ? -startHand : startHand;
  const x = lerp(startHand * HAND_SPACING, endHand * HAND_SPACING, easeInOutSine(clamped));
  const arcHeight = Math.max(0.25, Math.sqrt(height) * 1.45);
  const y = BASE_Y + Math.sin(Math.PI * clamped) * arcHeight - Math.abs(clamped - 0.5) * 0.24;
  const z = Math.sin(clamped * Math.PI * 2) * DEPTH_STEP * (crosses ? 1 : -1) + (height % 3) * 0.04;
  return { x, y, z };
}

export function getHandPosition(beat) {
  return { x: handForBeat(beat) * HAND_SPACING, y: HAND_Y, z: 0 };
}

export function samplePatternState(input, time, options = {}) {
  const validation = validateSiteswap(input);
  if (!validation.valid) return { ...validation, balls: [], throwsInFlight: [] };

  const { throws, period } = validation;
  const speed = options.speed ?? 1;
  const scaledTime = Math.max(0, time * speed);
  const currentBeat = Math.floor(scaledTime);
  const maxHeight = Math.max(...throws, 1);
  const throwsInFlight = [];

  for (let beat = currentBeat - maxHeight - period; beat <= currentBeat + 1; beat += 1) {
    const patternIndex = mod(beat, period);
    const height = throws[patternIndex];
    if (height <= 0) continue;
    const progress = (scaledTime - beat) / height;
    if (progress >= 0 && progress <= 1) {
      const position = getThrowPosition(beat, height, progress);
      throwsInFlight.push({
        id: `${beat}-${height}`,
        beat,
        patternIndex,
        height,
        progress,
        position,
        from: getHandPosition(beat),
        to: getHandPosition(beat + height),
        color: colorForHeight(height),
      });
    }
  }

  // Stable visual order keeps React/Three object updates predictable.
  throwsInFlight.sort((a, b) => a.beat - b.beat);
  return { ...validation, balls: throwsInFlight, throwsInFlight };
}

export function makeArcPoints(startBeat, height, segments = 40) {
  return Array.from({ length: segments + 1 }, (_, index) => getThrowPosition(startBeat, height, index / segments));
}

export function colorForHeight(height) {
  const palette = ['#8dd3ff', '#ffcc66', '#ff6b8a', '#8aff80', '#b497ff', '#ff9f43', '#5eead4', '#f472b6'];
  return palette[height % palette.length];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}
