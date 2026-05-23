import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeArcPoints, samplePatternState, validateSiteswap } from '../juggling/siteswap.js';
import { getMaterialOption, normalizeRenderFeatures } from './materialOptions.js';

const MAX_BALLS = 24;
const MAX_PEOPLE = 4;
const UP = new THREE.Vector3(0, 1, 0);

export function JugglingScene({
  pattern,
  speed,
  paused,
  showTrails,
  showGizmos,
  personCount,
  passing,
  passThreshold,
  ballMaterial = 'glass',
  customColor = '#8dd3ff',
  renderFeatures = {},
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    pattern,
    speed,
    paused,
    showTrails,
    showGizmos,
    personCount,
    passing,
    passThreshold,
    ballMaterial,
    customColor,
    renderFeatures,
  });

  useEffect(() => {
    stateRef.current = {
      pattern,
      speed,
      paused,
      showTrails,
      showGizmos,
      personCount,
      passing,
      passThreshold,
      ballMaterial,
      customColor,
      renderFeatures,
    };
  }, [pattern, speed, paused, showTrails, showGizmos, personCount, passing, passThreshold, ballMaterial, customColor, renderFeatures]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070914');
    scene.fog = new THREE.Fog('#070914', 10, 22);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 4.9, 11.6);
    camera.lookAt(0, 2.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const environmentMap = createStudioEnvironmentTexture();
    scene.environment = environmentMap;

    scene.add(new THREE.HemisphereLight('#bed8ff', '#15172b', 2.2));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.8);
    keyLight.position.set(-4, 9, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight('#8dd3ff', 2.2, 18);
    rimLight.position.set(4.5, 4.5, -3.8);
    scene.add(rimLight);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#10152a', metalness: 0.18, roughness: 0.7, envMapIntensity: 0.45 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 9), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(15, 18, '#2a3977', '#182044');
    grid.position.y = 0.012;
    scene.add(grid);

    const rearGlow = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.018, 8, 180),
      new THREE.MeshBasicMaterial({ color: '#5264ff', transparent: true, opacity: 0.62 })
    );
    rearGlow.rotation.x = Math.PI / 2;
    rearGlow.position.y = 0.03;
    scene.add(rearGlow);

    const textures = createProceduralTextures();
    const people = Array.from({ length: MAX_PEOPLE }, (_, index) => createPerson(index));
    people.forEach((person) => scene.add(person.group));

    const ballGroups = Array.from({ length: MAX_BALLS }, createBallGroup);
    ballGroups.forEach((ball) => scene.add(ball.group));

    const causticMeshes = Array.from({ length: MAX_BALLS }, () => createCausticMesh());
    causticMeshes.forEach((mesh) => scene.add(mesh));

    const arcGroup = new THREE.Group();
    scene.add(arcGroup);

    const gizmoGroup = new THREE.Group();
    const gizmoLines = Array.from({ length: MAX_BALLS }, () => createGizmoLine());
    const targetMarkers = Array.from({ length: MAX_BALLS }, () => createTargetMarker());
    gizmoLines.forEach((line) => gizmoGroup.add(line));
    targetMarkers.forEach((marker) => gizmoGroup.add(marker));
    scene.add(gizmoGroup);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let frameId;
    let previousArcSignature = '';
    let previousRenderSignature = '';

    function refreshBallMaterials(features) {
      const option = getMaterialOption(stateRef.current.ballMaterial);
      ballGroups.forEach((ball) => {
        ball.core.material?.dispose?.();
        ball.core.material = createBallMaterial(option.id, {
          color: stateRef.current.customColor,
          features,
          environmentMap,
          textures,
        });
        ball.ringX.visible = option.id !== 'baseball' && option.id !== 'cotton';
        ball.ringY.visible = option.id !== 'baseball' && option.id !== 'cotton';
      });
    }

    function refreshRenderFeatures(features) {
      renderer.shadowMap.enabled = features.shadows;
      scene.environment = features.environmentMap ? environmentMap : null;
      floor.receiveShadow = features.shadows;
      floorMaterial.metalness = features.reflection ? 0.5 : 0.18;
      floorMaterial.envMapIntensity = features.environmentMap ? (features.reflection ? 1.1 : 0.45) : 0;
      floorMaterial.needsUpdate = true;
      setObjectShadowing(scene, features.shadows);
      refreshBallMaterials(features);
    }

    function refreshArcs(validation) {
      disposeGroup(arcGroup);
      const state = stateRef.current;
      if (!state.showTrails || !validation.valid) return;
      const count = normalizedPersonCount(state.personCount);
      for (let personIndex = 0; personIndex < count; personIndex += 1) {
        validation.throws.forEach((height, beatIndex) => {
          if (height <= 0) return;
          const arcOptions = {
            personCount: count,
            personIndex,
            passing: state.passing,
            passThreshold: state.passThreshold,
          };
          const points = makeArcPoints(beatIndex, height, 48, arcOptions).map((p) => new THREE.Vector3(p.x, p.y, p.z));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const color = new THREE.Color().setHSL((height * 0.11 + personIndex * 0.18) % 1, 0.82, 0.65);
          const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: state.passing && height >= state.passThreshold ? 0.55 : 0.28 });
          arcGroup.add(new THREE.Line(geometry, material));

          if (state.showGizmos) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(0.08, 0.22, 14),
              new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 })
            );
            const end = points.at(-1);
            const prev = points.at(-3) ?? points.at(-2);
            cone.position.copy(end);
            orientObjectBetween(cone, prev, end);
            arcGroup.add(cone);
          }
        });
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      if (!stateRef.current.paused) elapsed += clock.getDelta();
      else clock.getDelta();

      const state = stateRef.current;
      const features = normalizeRenderFeatures(state.renderFeatures);
      const count = normalizedPersonCount(state.personCount);
      const validation = validateSiteswap(state.pattern);
      const arcSignature = `${state.pattern}|${state.showTrails}|${state.showGizmos}|${count}|${state.passing}|${state.passThreshold}|${validation.valid}`;
      if (arcSignature !== previousArcSignature) {
        refreshArcs(validation);
        previousArcSignature = arcSignature;
      }

      const renderSignature = `${state.ballMaterial}|${state.customColor}|${Object.values(features).join('|')}`;
      if (renderSignature !== previousRenderSignature) {
        refreshRenderFeatures(features);
        previousRenderSignature = renderSignature;
      }

      const sample = samplePatternState(state.pattern, elapsed, {
        speed: state.speed,
        personCount: count,
        passing: state.passing,
        passThreshold: state.passThreshold,
      });

      people.forEach((person, index) => {
        const pose = sample.people[index];
        person.group.visible = Boolean(pose);
        if (pose) updatePerson(person, pose, elapsed);
      });

      ballGroups.forEach((ballGroup, index) => {
        const ball = sample.balls[index];
        ballGroup.group.visible = Boolean(ball);
        gizmoLines[index].visible = Boolean(ball && state.showGizmos);
        targetMarkers[index].visible = Boolean(ball && state.showGizmos);
        causticMeshes[index].visible = Boolean(ball && features.caustics);
        if (!ball) return;

        ballGroup.group.position.set(ball.position.x, ball.position.y, ball.position.z);
        ballGroup.group.rotation.set(ball.rotation.x, ball.rotation.y, ball.rotation.z);
        updateBallAppearance(ballGroup, ball, elapsed, state.ballMaterial, state.customColor, features);
        const pulse = 1 + Math.sin((ball.progress + elapsed) * Math.PI * 2) * 0.045;
        ballGroup.group.scale.setScalar(ball.pass ? pulse * 1.16 : pulse);

        updateGizmoLine(gizmoLines[index], ball.position, ball.to, ball.pass ? '#ffcc66' : '#8dd3ff');
        targetMarkers[index].position.set(ball.to.x, ball.to.y, ball.to.z);
        targetMarkers[index].material.color.set(ball.pass ? '#ffcc66' : '#8dd3ff');
        updateCaustic(causticMeshes[index], ball, elapsed, state.ballMaterial, features);
      });

      camera.position.x = Math.sin(elapsed * 0.11) * 0.52;
      camera.lookAt(0, 2.1, 0);
      renderer.render(scene, camera);
    }

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener('resize', resize);
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      disposeGroup(scene);
      environmentMap.dispose();
      Object.values(textures).forEach((texture) => texture.dispose?.());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-mount" ref={mountRef} aria-label="3D juggling siteswap visualizer" />;
}

function createPerson(index) {
  const group = new THREE.Group();
  const color = index === 0 ? '#8dd3ff' : index === 1 ? '#ffcc66' : index === 2 ? '#b497ff' : '#8aff80';
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#dfe7ff', emissive: '#111936', roughness: 0.42, envMapIntensity: 0.45 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.35, envMapIntensity: 0.5 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: '#f4c7a4', roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.0, 22), bodyMaterial);
  torso.position.y = 1.13;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 28, 16), skinMaterial);
  head.castShadow = true;
  group.add(head);

  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), accentMaterial.clone());
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), accentMaterial.clone());
  leftHand.castShadow = true;
  rightHand.castShadow = true;
  group.add(leftHand, rightHand);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1, 12), accentMaterial.clone());
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1, 12), accentMaterial.clone());
  leftArm.castShadow = true;
  rightArm.castShadow = true;
  group.add(leftArm, rightArm);

  const base = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 8, 52), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.05;
  group.add(base);

  return { group, torso, head, leftHand, rightHand, leftArm, rightArm, color };
}

function updatePerson(person, pose, elapsed) {
  person.group.position.set(0, 0, 0);
  person.torso.position.set(pose.body.x, pose.body.y, pose.body.z);
  person.torso.rotation.z = Math.sin(elapsed * 2.4 + pose.personIndex) * 0.035;
  person.head.position.set(pose.head.x, pose.head.y, pose.head.z);
  person.leftHand.position.set(pose.leftHand.x, pose.leftHand.y, pose.leftHand.z);
  person.rightHand.position.set(pose.rightHand.x, pose.rightHand.y, pose.rightHand.z);

  const leftShoulder = new THREE.Vector3(pose.body.x - 0.24, pose.body.y + 0.34, pose.body.z);
  const rightShoulder = new THREE.Vector3(pose.body.x + 0.24, pose.body.y + 0.34, pose.body.z);
  updateLimb(person.leftArm, leftShoulder, person.leftHand.position);
  updateLimb(person.rightArm, rightShoulder, person.rightHand.position);
}

function createBallGroup() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 64, 32),
    new THREE.MeshPhysicalMaterial({ color: '#8dd3ff', roughness: 0.18, metalness: 0.18 })
  );
  const ringX = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.01, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.78 }));
  const ringY = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.008, 8, 36), new THREE.MeshBasicMaterial({ color: '#8dd3ff', transparent: true, opacity: 0.62 }));
  ringX.rotation.x = Math.PI / 2;
  ringY.rotation.y = Math.PI / 2;
  core.castShadow = true;
  group.add(core, ringX, ringY);
  group.visible = false;
  return { group, core, ringX, ringY };
}

function createBallMaterial(materialId, { color, features, environmentMap, textures }) {
  const envMap = features.environmentMap ? environmentMap : null;
  const envMapIntensity = features.environmentMap ? (features.reflection ? 1.8 : 0.85) : 0;
  switch (materialId) {
    case 'steel':
      return new THREE.MeshPhysicalMaterial({ color: '#dfe7ef', metalness: 1, roughness: 0.12, envMap, envMapIntensity: envMapIntensity * 1.6, clearcoat: 1, clearcoatRoughness: 0.08 });
    case 'wood':
      return new THREE.MeshPhysicalMaterial({ color: '#bc7a3e', map: textures.wood, metalness: 0.05, roughness: 0.52, envMap, envMapIntensity: envMapIntensity * 0.45, clearcoat: 0.35, clearcoatRoughness: 0.38 });
    case 'fire':
      return new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, baseColor: { value: new THREE.Color('#ff6a00') } },
        vertexShader: `varying vec2 vUv; varying vec3 vNormal; void main(){ vUv=uv; vNormal=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float time; uniform vec3 baseColor; varying vec2 vUv; varying vec3 vNormal; float noise(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); } void main(){ float flame=sin((vUv.y+time*0.9)*18.0)+sin((vUv.x-time*0.5)*27.0); flame += noise(vUv*8.0+time)*1.8; float hot=smoothstep(-0.2,2.1,flame+vUv.y*1.4); vec3 col=mix(vec3(0.22,0.02,0.0), mix(baseColor, vec3(1.0,0.92,0.25), hot), hot); float rim=pow(1.0-abs(vNormal.z),2.0); gl_FragColor=vec4(col + rim*vec3(0.6,0.15,0.0),1.0); }`,
      });
    case 'baseball':
      return new THREE.MeshPhysicalMaterial({ color: '#fff8eb', map: textures.baseball, roughness: 0.68, metalness: 0, envMap, envMapIntensity: envMapIntensity * 0.25 });
    case 'cotton':
      return new THREE.MeshPhysicalMaterial({ color: '#f1eee4', map: textures.cotton, roughness: 0.95, metalness: 0, envMap, envMapIntensity: envMapIntensity * 0.12 });
    case 'custom':
      return new THREE.MeshPhysicalMaterial({ color, metalness: features.reflection ? 0.38 : 0.12, roughness: features.reflection ? 0.22 : 0.44, envMap, envMapIntensity, clearcoat: features.reflection ? 0.8 : 0.25, clearcoatRoughness: 0.18 });
    case 'glass':
    default:
      return new THREE.MeshPhysicalMaterial({
        color: '#bfe9ff',
        metalness: 0,
        roughness: 0.03,
        transmission: features.refraction ? 0.92 : 0.55,
        transparent: true,
        opacity: features.refraction ? 0.58 : 0.82,
        thickness: features.refraction ? 0.75 : 0.18,
        ior: features.refraction ? 1.52 : 1.25,
        envMap,
        envMapIntensity: envMapIntensity * 1.45,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
      });
  }
}

function updateBallAppearance(ballGroup, ball, elapsed, materialId, customColor, features) {
  const material = ballGroup.core.material;
  if (material.uniforms?.time) material.uniforms.time.value = elapsed + ball.beat * 0.11;
  if (materialId === 'custom' && material.color) material.color.set(customColor);
  if (materialId === 'glass' && material.color) material.color.set(ball.pass ? '#ffe6a3' : '#bfe9ff');
  if (materialId === 'fire' && material.uniforms?.baseColor) material.uniforms.baseColor.value.set(ball.pass ? '#ffcc00' : '#ff5a00');
  ballGroup.ringX.material.color.set(ball.pass ? '#ffffff' : materialId === 'fire' ? '#ffd166' : ball.color);
  ballGroup.ringY.material.color.set(materialId === 'steel' ? '#dfe7ef' : ball.color);
  ballGroup.ringX.material.opacity = features.reflection || materialId === 'glass' ? 0.78 : 0.42;
  ballGroup.ringY.material.opacity = features.reflection || materialId === 'glass' ? 0.62 : 0.32;
}

function createCausticMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.5, 48),
    new THREE.MeshBasicMaterial({ color: '#9ee7ff', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.026;
  mesh.visible = false;
  return mesh;
}

function updateCaustic(mesh, ball, elapsed, materialId, features) {
  mesh.position.x = ball.position.x;
  mesh.position.z = ball.position.z;
  const heightFade = Math.max(0.05, 1 - ball.position.y / 5.5);
  const reflectiveBoost = materialId === 'glass' || materialId === 'steel' ? 1.4 : materialId === 'fire' ? 1.9 : 0.7;
  const scale = (0.7 + ball.position.y * 0.18) * (ball.pass ? 1.25 : 1);
  mesh.scale.set(scale, scale, scale);
  mesh.rotation.z = elapsed * 1.8 + ball.beat;
  mesh.material.opacity = features.caustics ? 0.12 * heightFade * reflectiveBoost : 0;
  mesh.material.color.set(materialId === 'fire' ? '#ff9f1c' : materialId === 'steel' ? '#e7f2ff' : '#9ee7ff');
}

function createProceduralTextures() {
  return {
    wood: makeCanvasTexture((ctx, size) => {
      ctx.fillStyle = '#8b4d22';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 5) {
        const wave = Math.sin(y * 0.08) * 18;
        ctx.strokeStyle = y % 20 === 0 ? '#e1a05b' : '#5f351b';
        ctx.lineWidth = y % 20 === 0 ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 12) ctx.lineTo(x, y + Math.sin((x + y) * 0.05) * 6 + wave * 0.04);
        ctx.stroke();
      }
    }),
    baseball: makeCanvasTexture((ctx, size) => {
      ctx.fillStyle = '#fff7e8';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#c8212c';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(size * 0.15, size * 0.5, size * 0.38, -1.2, 1.2);
      ctx.arc(size * 0.85, size * 0.5, size * 0.38, Math.PI - 1.2, Math.PI + 1.2);
      ctx.stroke();
      for (let i = 0; i < 18; i += 1) {
        const y = 22 + i * 12;
        ctx.strokeStyle = '#b31324';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size * 0.29, y);
        ctx.lineTo(size * 0.38, y + 8);
        ctx.moveTo(size * 0.71, y);
        ctx.lineTo(size * 0.62, y + 8);
        ctx.stroke();
      }
    }),
    cotton: makeCanvasTexture((ctx, size) => {
      ctx.fillStyle = '#ebe8dc';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 550; i += 1) {
        const alpha = 0.08 + Math.random() * 0.12;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 24 - 12, y + Math.random() * 10 - 5);
        ctx.stroke();
      }
    }),
  };
}

function makeCanvasTexture(draw) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createStudioEnvironmentTexture() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#d7ecff');
  gradient.addColorStop(0.32, '#25306d');
  gradient.addColorStop(0.7, '#070914');
  gradient.addColorStop(1, '#04050d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + i * 0.015})`;
    ctx.fillRect(70 + i * 96, 70 + (i % 3) * 34, 44 + i * 8, 120 - i * 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createGizmoLine() {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const material = new THREE.LineDashedMaterial({ color: '#8dd3ff', dashSize: 0.11, gapSize: 0.08, transparent: true, opacity: 0.62 });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.visible = false;
  return line;
}

function createTargetMarker() {
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: '#8dd3ff', transparent: true, opacity: 0.86 })
  );
  marker.visible = false;
  return marker;
}

function updateGizmoLine(line, from, to, color) {
  line.geometry.setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  line.computeLineDistances();
  line.material.color.set(color);
}

function updateLimb(limb, start, end) {
  const startVector = start instanceof THREE.Vector3 ? start : new THREE.Vector3(start.x, start.y, start.z);
  const endVector = end instanceof THREE.Vector3 ? end : new THREE.Vector3(end.x, end.y, end.z);
  const midpoint = startVector.clone().lerp(endVector, 0.5);
  const direction = endVector.clone().sub(startVector);
  const length = Math.max(0.001, direction.length());
  limb.position.copy(midpoint);
  limb.scale.set(1, length, 1);
  limb.quaternion.setFromUnitVectors(UP, direction.normalize());
}

function orientObjectBetween(object, from, to) {
  const direction = to.clone().sub(from).normalize();
  object.quaternion.setFromUnitVectors(UP, direction);
}

function setObjectShadowing(object, enabled) {
  object.traverse?.((child) => {
    if (child.isMesh) {
      child.castShadow = enabled && child.type !== 'GridHelper';
      if (child.geometry?.type === 'PlaneGeometry') child.receiveShadow = enabled;
    }
  });
}

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    disposeGroup(child);
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  }
}

function normalizedPersonCount(value) {
  return Math.max(1, Math.min(4, Math.round(Number(value) || 1)));
}
