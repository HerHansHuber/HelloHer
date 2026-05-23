export const BALL_MATERIALS = [
  {
    id: 'glass',
    label: 'Glass',
    description: 'Transparent polished glass with reflection/refraction support.',
    color: '#bfe9ff',
  },
  {
    id: 'steel',
    label: 'Steel',
    description: 'Mirror-like chrome steel balls.',
    color: '#dce4ee',
  },
  {
    id: 'wood',
    label: 'Wood',
    description: 'Procedural warm wood grain.',
    color: '#b8783c',
  },
  {
    id: 'fire',
    label: 'Fire shader',
    description: 'Animated emissive flame shader.',
    color: '#ff6a00',
  },
  {
    id: 'baseball',
    label: 'Baseball',
    description: 'White leather with red stitch texture.',
    color: '#f8f3e8',
  },
  {
    id: 'cotton',
    label: 'Cotton',
    description: 'Soft rough fabric texture.',
    color: '#f2f0e8',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'User-controlled color with balanced PBR defaults.',
    color: '#8dd3ff',
  },
];

export const RENDER_FEATURES = [
  { id: 'caustics', label: 'Caustics', description: 'Animated light ripples under glossy balls.' },
  { id: 'shadows', label: 'Shadows', description: 'Real-time cast/receive shadows.' },
  { id: 'reflection', label: 'Reflection', description: 'Higher metalness/env intensity on reflective materials.' },
  { id: 'refraction', label: 'Refraction', description: 'Glass transmission, thickness, and IOR.' },
  { id: 'environmentMap', label: 'Environmental mapping', description: 'Procedural studio environment map.' },
];

export const DEFAULT_RENDER_FEATURES = {
  caustics: false,
  shadows: true,
  reflection: false,
  refraction: false,
  environmentMap: true,
};

export function getMaterialOption(id) {
  return BALL_MATERIALS.find((material) => material.id === id) ?? BALL_MATERIALS[0];
}

export function normalizeRenderFeatures(features = {}) {
  return Object.fromEntries(
    RENDER_FEATURES.map((feature) => [feature.id, Boolean(features[feature.id] ?? DEFAULT_RENDER_FEATURES[feature.id])])
  );
}
