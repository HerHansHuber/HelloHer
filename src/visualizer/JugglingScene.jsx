import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeArcPoints, samplePatternState, validateSiteswap } from '../juggling/siteswap.js';

export function JugglingScene({ pattern, speed, paused, showTrails }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ pattern, speed, paused, showTrails });

  useEffect(() => {
    stateRef.current = { pattern, speed, paused, showTrails };
  }, [pattern, speed, paused, showTrails]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070914');
    scene.fog = new THREE.Fog('#070914', 7, 15);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 4.2, 8.4);
    camera.lookAt(0, 1.9, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#bed8ff', '#15172b', 2.4));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.5);
    keyLight.position.set(-3, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.7, 4.7, 0.08, 96),
      new THREE.MeshStandardMaterial({ color: '#11162a', metalness: 0.25, roughness: 0.58 })
    );
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.72, 0.018, 8, 160),
      new THREE.MeshBasicMaterial({ color: '#5264ff' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    const handGroup = new THREE.Group();
    const handMaterial = new THREE.MeshStandardMaterial({ color: '#e9eefc', emissive: '#182055', roughness: 0.36 });
    [-1, 1].forEach((side) => {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), handMaterial);
      hand.position.set(side * 2.25, 0.42, 0);
      hand.castShadow = true;
      handGroup.add(hand);
    });
    scene.add(handGroup);

    const ballGeometry = new THREE.SphereGeometry(0.16, 32, 16);
    const ballMeshes = [];
    for (let index = 0; index < 12; index += 1) {
      const mesh = new THREE.Mesh(ballGeometry, new THREE.MeshStandardMaterial({ color: '#8dd3ff', emissive: '#111827', roughness: 0.22 }));
      mesh.castShadow = true;
      mesh.visible = false;
      ballMeshes.push(mesh);
      scene.add(mesh);
    }

    const arcGroup = new THREE.Group();
    scene.add(arcGroup);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024;
    labelCanvas.height = 256;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true }));
    label.scale.set(5.2, 1.3, 1);
    label.position.set(0, 4.25, -0.5);
    scene.add(label);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let frameId;

    function updateLabel(validation) {
      const ctx = labelCanvas.getContext('2d');
      ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      ctx.fillStyle = 'rgba(8, 12, 28, 0.62)';
      roundRect(ctx, 24, 28, 976, 178, 34);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 72px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stateRef.current.pattern || '—', 512, 108);
      ctx.font = '500 34px Inter, system-ui, sans-serif';
      ctx.fillStyle = validation.valid ? '#8affb2' : '#ff7b94';
      ctx.fillText(validation.reason, 512, 165);
      labelTexture.needsUpdate = true;
    }

    function refreshArcs(validation) {
      arcGroup.clear();
      if (!stateRef.current.showTrails || !validation.valid) return;
      validation.throws.forEach((height, index) => {
        if (height <= 0) return;
        const points = makeArcPoints(index, height).map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: new THREE.Color().setHSL((height * 0.11) % 1, 0.82, 0.65), transparent: true, opacity: 0.32 });
        arcGroup.add(new THREE.Line(geometry, material));
      });
    }

    let previousSignature = '';
    function animate() {
      frameId = requestAnimationFrame(animate);
      if (!stateRef.current.paused) elapsed += clock.getDelta();
      else clock.getDelta();

      const validation = validateSiteswap(stateRef.current.pattern);
      const signature = `${stateRef.current.pattern}|${stateRef.current.showTrails}|${validation.valid}`;
      if (signature !== previousSignature) {
        updateLabel(validation);
        refreshArcs(validation);
        previousSignature = signature;
      }

      const sample = samplePatternState(stateRef.current.pattern, elapsed, { speed: stateRef.current.speed });
      ballMeshes.forEach((mesh, index) => {
        const ball = sample.balls[index];
        mesh.visible = Boolean(ball);
        if (ball) {
          mesh.position.set(ball.position.x, ball.position.y, ball.position.z);
          mesh.material.color.set(ball.color);
          mesh.material.emissive.set(ball.color).multiplyScalar(0.18);
          const pulse = 1 + Math.sin((ball.progress + elapsed) * Math.PI * 2) * 0.05;
          mesh.scale.setScalar(pulse);
        }
      });

      handGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.04;
      camera.position.x = Math.sin(elapsed * 0.12) * 0.45;
      camera.lookAt(0, 1.9, 0);
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
      renderer.dispose();
      ballGeometry.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-mount" ref={mountRef} aria-label="3D juggling siteswap visualizer" />;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
