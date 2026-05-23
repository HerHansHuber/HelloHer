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

const HAND_SPACING = 0.92;
const PERSON_SPACING = 4.7;
const BASE_Y = 0.72;
const HAND_Y = 1.28;
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

export function normalizeSceneOptions(options = {}) {
  return {
    personCount: clamp(Math.round(options.personCount ?? 1), 1, 4),
    passing: Boolean(options.passing),
    passThreshold: Math.max(1, Number(options.passThreshold ?? 5)),
    speed: options.speed ?? 1,
  };
}

export function getPersonOffset(personIndex = 0, personCount = 1) {
  return (personIndex - (personCount - 1) / 2) * PERSON_SPACING;
}

export function getHandPosition(beat, options = {}) {
  const { personIndex = 0, personCount = 1, time = beat } = options;
  const side = handForBeat(beat);
  const bodyX = getPersonOffset(personIndex, personCount);
  const lift = 0.28
    + Math.max(0, Math.sin((time - beat + 0.15) * Math.PI)) * 0.34
    + Math.sin(time * Math.PI * 2 + personIndex * 0.7 + side) * 0.08;
  const reach = 1 + Math.max(0, Math.sin((time - beat) * Math.PI)) * 0.22;
  return {
    x: bodyX + side * HAND_SPACING * reach,
    y: HAND_Y + lift,
    z: (personIndex - (personCount - 1) / 2) * 0.2,
    side,
    personIndex,
  };
}

export function getThrowEndpoints(startBeat, height, options = {}) {
  const scene = normalizeSceneOptions(options);
  const fromPerson = options.personIndex ?? 0;
  const passThrow = scene.passing && scene.personCount > 1 && height >= scene.passThreshold;
  const toPerson = passThrow ? (fromPerson + 1) % scene.personCount : fromPerson;
  return {
    from: getHandPosition(startBeat, { ...scene, personIndex: fromPerson, time: options.time ?? startBeat }),
    to: getHandPosition(startBeat + height, { ...scene, personIndex: toPerson, time: options.time ?? startBeat + height }),
    pass: passThrow,
    fromPerson,
    toPerson,
  };
}

export function getThrowPosition(startBeat, height, progress, options = {}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const { from, to, pass } = getThrowEndpoints(startBeat, height, options);
  const x = lerp(from.x, to.x, easeInOutSine(clamped));
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const arcHeight = Math.max(0.25, Math.sqrt(height) * 1.18 + distance * 0.16);
  const y = BASE_Y + Math.sin(Math.PI * clamped) * arcHeight + lerp(from.y, to.y, clamped) * 0.28;
  const z = lerp(from.z, to.z, clamped) + Math.sin(clamped * Math.PI * 2) * DEPTH_STEP * (pass ? 1.8 : 1) + (height % 3) * 0.04;
  return { x, y, z };
}

export function getPersonPoses(input, time, options = {}) {
  const scene = normalizeSceneOptions(options);
  const validation = validateSiteswap(input);
  const beat = Math.floor(Math.max(0, time * scene.speed));
  const phase = (Math.max(0, time * scene.speed) % 1);
  const bob = Math.sin(time * Math.PI * 2) * 0.035;

  return Array.from({ length: scene.personCount }, (_, personIndex) => {
    const bodyX = getPersonOffset(personIndex, scene.personCount);
    const leftBeat = beat % 2 === 0 ? beat : beat + 1;
    const rightBeat = beat % 2 === 1 ? beat : beat + 1;
    const leftHand = getHandPosition(leftBeat, { ...scene, personIndex, time: beat + phase });
    const rightHand = getHandPosition(rightBeat, { ...scene, personIndex, time: beat + phase });
    const activity = validation.valid ? validation.throws[beat % validation.period] ?? 3 : 3;
    return {
      personIndex,
      body: { x: bodyX, y: 0.9 + bob, z: personIndex % 2 === 0 ? 0.12 : -0.12 },
      head: { x: bodyX, y: 2.08 + bob, z: 0 },
      leftHand,
      rightHand,
      rhythm: phase,
      activity,
      color: personIndex === 0 ? '#8dd3ff' : personIndex === 1 ? '#ffcc66' : colorForHeight(personIndex + 4),
    };
  });
}

export function samplePatternState(input, time, options = {}) {
  const validation = validateSiteswap(input);
  const scene = normalizeSceneOptions(options);
  if (!validation.valid) return { ...validation, balls: [], throwsInFlight: [], people: getPersonPoses(input, time, scene) };

  const { throws, period } = validation;
  const scaledTime = Math.max(0, time * scene.speed);
  const currentBeat = Math.floor(scaledTime);
  const maxHeight = Math.max(...throws, 1);
  const throwsInFlight = [];

  for (let personIndex = 0; personIndex < scene.personCount; personIndex += 1) {
    const personPhase = scene.passing ? personIndex * 0.5 : 0;
    const personTime = scaledTime + personPhase;
    const personBeat = Math.floor(personTime);

    for (let beat = personBeat - maxHeight - period; beat <= personBeat + 1; beat += 1) {
      const patternIndex = mod(beat, period);
      const height = throws[patternIndex];
      if (height <= 0) continue;
      const progress = (personTime - beat) / height;
      if (progress >= 0 && progress <= 1) {
        const endpointOptions = { ...scene, personIndex, time: beat + progress };
        const position = getThrowPosition(beat, height, progress, endpointOptions);
        const endpoints = getThrowEndpoints(beat, height, endpointOptions);
        throwsInFlight.push({
          id: `${personIndex}-${beat}-${height}`,
          beat,
          patternIndex,
          height,
          progress,
          position,
          from: endpoints.from,
          to: endpoints.to,
          pass: endpoints.pass,
          fromPerson: endpoints.fromPerson,
          toPerson: endpoints.toPerson,
          rotation: {
            x: (beat + progress) * height * 1.7,
            y: (personIndex + 1) * 0.6 + progress * Math.PI * 2,
            z: (height % 4) * 0.45 + progress * Math.PI,
          },
          color: endpoints.pass ? '#ffcc66' : colorForHeight(height),
        });
      }
    }
  }

  throwsInFlight.sort((a, b) => a.beat - b.beat || a.fromPerson - b.fromPerson);
  return { ...validation, balls: throwsInFlight, throwsInFlight, people: getPersonPoses(input, time, scene) };
}

export function makeArcPoints(startBeat, height, segments = 40, options = {}) {
  return Array.from({ length: segments + 1 }, (_, index) => getThrowPosition(startBeat, height, index / segments, options));
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
