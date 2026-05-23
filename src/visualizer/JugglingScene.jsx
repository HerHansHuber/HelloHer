import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeArcPoints, samplePatternState, validateSiteswap } from '../juggling/siteswap.js';

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
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({ pattern, speed, paused, showTrails, showGizmos, personCount, passing, passThreshold });

  useEffect(() => {
    stateRef.current = { pattern, speed, paused, showTrails, showGizmos, personCount, passing, passThreshold };
  }, [pattern, speed, paused, showTrails, showGizmos, personCount, passing, passThreshold]);

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
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#bed8ff', '#15172b', 2.2));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.8);
    keyLight.position.set(-4, 9, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight('#8dd3ff', 2.2, 18);
    rimLight.position.set(4.5, 4.5, -3.8);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 9),
      new THREE.MeshStandardMaterial({ color: '#10152a', metalness: 0.18, roughness: 0.7 })
    );
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

    const people = Array.from({ length: MAX_PEOPLE }, (_, index) => createPerson(index));
    people.forEach((person) => scene.add(person.group));

    const ballGroups = Array.from({ length: MAX_BALLS }, createBallGroup);
    ballGroups.forEach((ball) => scene.add(ball.group));

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
    let previousSignature = '';

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
      const count = normalizedPersonCount(state.personCount);
      const validation = validateSiteswap(state.pattern);
      const signature = `${state.pattern}|${state.showTrails}|${state.showGizmos}|${count}|${state.passing}|${state.passThreshold}|${validation.valid}`;
      if (signature !== previousSignature) {
        refreshArcs(validation);
        previousSignature = signature;
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
        if (!ball) return;

        ballGroup.group.position.set(ball.position.x, ball.position.y, ball.position.z);
        ballGroup.group.rotation.set(ball.rotation.x, ball.rotation.y, ball.rotation.z);
        ballGroup.core.material.color.set(ball.color);
        ballGroup.core.material.emissive.set(ball.color).multiplyScalar(ball.pass ? 0.3 : 0.16);
        ballGroup.ringX.material.color.set(ball.pass ? '#ffffff' : ball.color);
        ballGroup.ringY.material.color.set(ball.color);
        const pulse = 1 + Math.sin((ball.progress + elapsed) * Math.PI * 2) * 0.045;
        ballGroup.group.scale.setScalar(ball.pass ? pulse * 1.16 : pulse);

        updateGizmoLine(gizmoLines[index], ball.position, ball.to, ball.pass ? '#ffcc66' : '#8dd3ff');
        targetMarkers[index].position.set(ball.to.x, ball.to.y, ball.to.z);
        targetMarkers[index].material.color.set(ball.pass ? '#ffcc66' : '#8dd3ff');
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-mount" ref={mountRef} aria-label="3D juggling siteswap visualizer" />;
}

function createPerson(index) {
  const group = new THREE.Group();
  const color = index === 0 ? '#8dd3ff' : index === 1 ? '#ffcc66' : index === 2 ? '#b497ff' : '#8aff80';
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#dfe7ff', emissive: '#111936', roughness: 0.42 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.35 });
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
    new THREE.SphereGeometry(0.16, 32, 16),
    new THREE.MeshStandardMaterial({ color: '#8dd3ff', emissive: '#111827', roughness: 0.18, metalness: 0.18 })
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
