# HelloHer Juggling Lab

A React + Three.js siteswap visualizer inspired by [JugglingLab](https://jugglinglab.org/).

## Features

- Basic asynchronous siteswap parser and validator
- Integer ball-count and landing-collision checks
- Preset patterns such as `3`, `441`, `531`, `744`, and `97531`
- Three.js 3D ball animation with optional trajectory arcs
- React controls for custom pattern entry, speed, pause/resume, and preset selection

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Notes

This is not a full JugglingLab port. It implements a focused browser-friendly subset of JugglingLab-style asynchronous siteswap logic for interactive visualization.
