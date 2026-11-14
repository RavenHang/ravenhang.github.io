import * as THREE from './lib/three.module.min.js';

// Three.js 0.160.1, locally vendored from the official npm package (MIT).
// All portfolio text and navigation remain ordinary, accessible HTML.
const hero = document.querySelector('[data-personal-hero]');
const host = hero?.querySelector('[data-hero-scene]');
if (hero && host) createScene();

function createScene() {
  const controls = hero.querySelector('[data-scene-controls]');
  const pauseButton = hero.querySelector('[data-scene-pause]');
  const resetButton = hero.querySelector('[data-scene-reset]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  let scene;
  let frame = 0;
  let failed = false;
  let visible = true;
  let paused = reducedMotion.matches;
  let settling = 0;
  let lastTime = 0;
  let phase = 0;
  let drag = null;
  let yaw = 0;
  let pitch = 0;
  const pointer = { x: 0, y: 0 };
  let resizeObserver;
  let visibilityObserver;

  const fallback = () => {
    if (failed) return;
    failed = true;
    cancelAnimationFrame(frame);
    hero.dataset.sceneState = 'fallback';
    if (controls) controls.hidden = true;
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    renderer?.domElement.remove();
    if (scene) {
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    }
    renderer?.dispose();
  };

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0xeef6ff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.touchAction = 'pan-y';
    host.appendChild(canvas);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xeef6ff, 16, 32);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    const cameraOrigin = new THREE.Vector3(6.3, 4.7, 10.1);
    const lookAt = new THREE.Vector3(0, 1.35, 0);
    camera.position.copy(cameraOrigin);
    camera.lookAt(lookAt);

    scene.add(new THREE.HemisphereLight(0xf5fbff, 0x759abf, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(-4, 8, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 25 });
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x73c9ff, 2.4);
    rim.position.set(5, 4, -5);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 1.5);
    fill.position.set(5, 1, 6);
    scene.add(fill);

    const blue = new THREE.MeshStandardMaterial({ color: 0x1b71d2, roughness: 0.32, metalness: 0.22 });
    const deepBlue = new THREE.MeshStandardMaterial({ color: 0x174a87, roughness: 0.48, metalness: 0.12 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf9fcff, roughness: 0.28, metalness: 0.08 });
    const ice = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.28, metalness: 0.16 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x54cce9, emissive: 0x1c7eab, emissiveIntensity: 0.28, roughness: 0.28 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x58bdf6 });
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x6bbaf0, emissive: 0x0c4163, emissiveIntensity: 0.18, roughness: 0.4, metalness: 0.32 });
    const root = new THREE.Group();
    scene.add(root);

    function mesh(geometry, material, parent = root, position = [0, 0, 0]) {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(...position);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    function roundedPlate(width, height, radius, depth, material, parent, position) {
      const shape = new THREE.Shape();
      const x = -width / 2;
      const y = -height / 2;
      shape.moveTo(x + radius, y);
      shape.lineTo(x + width - radius, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + radius);
      shape.lineTo(x + width, y + height - radius);
      shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      shape.lineTo(x + radius, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - radius);
      shape.lineTo(x, y + radius);
      shape.quadraticCurveTo(x, y, x + radius, y);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 8
      });
      return mesh(geometry, material, parent, position);
    }

    // An articulated performer and its pose traces introduce animation generation.
    const performer = new THREE.Group();
    performer.position.set(-1.22, 0.12, 0.48);
    performer.rotation.y = 0.28;
    root.add(performer);
    const jointGeometry = new THREE.SphereGeometry(0.095, 16, 12);
    const makeJoint = (parent, position, size = 1) => {
      const joint = mesh(jointGeometry, cyan, parent, position);
      joint.scale.setScalar(size);
      return joint;
    };
    const limb = (parent, position, upperLength, lowerLength, radius, material) => {
      const pivot = new THREE.Group();
      pivot.position.set(...position);
      parent.add(pivot);
      makeJoint(pivot, [0, 0, 0], radius / 0.075);
      mesh(new THREE.CapsuleGeometry(radius, upperLength - radius * 2, 5, 12), material, pivot, [0, -upperLength / 2, 0]);
      const bend = new THREE.Group();
      bend.position.y = -upperLength;
      pivot.add(bend);
      makeJoint(bend, [0, 0, 0], radius / 0.08);
      mesh(new THREE.CapsuleGeometry(radius * 0.85, lowerLength - radius * 1.7, 5, 12), white, bend, [0, -lowerLength / 2, 0]);
      return { pivot, bend, end: [0, -lowerLength, 0] };
    };
    const torso = roundedPlate(0.61, 0.76, 0.16, 0.29, white, performer, [0, 1.66, -0.15]);
    torso.rotation.x = -0.05;
    roundedPlate(0.33, 0.36, 0.08, 0.03, blue, performer, [0, 1.74, 0.19]);
    mesh(new THREE.SphereGeometry(0.07, 16, 12), cyan, performer, [0, 1.78, 0.25]);
    mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.14, 20), deepBlue, performer, [0, 2.12, 0]);
    const performerHead = mesh(new THREE.SphereGeometry(0.285, 28, 20), white, performer, [0, 2.44, 0.015]);
    performerHead.scale.set(0.92, 1.08, 0.94);
    const visor = roundedPlate(0.31, 0.11, 0.045, 0.025, blue, performer, [0, 2.47, 0.255]);
    visor.rotation.x = -0.08;
    mesh(new THREE.CapsuleGeometry(0.16, 0.19, 5, 16), blue, performer, [0, 1.23, 0]).rotation.z = Math.PI / 2;
    const leftArm = limb(performer, [-0.43, 1.96, 0], 0.43, 0.43, 0.085, blue);
    const rightArm = limb(performer, [0.43, 1.96, 0], 0.43, 0.43, 0.085, blue);
    makeJoint(leftArm.bend, leftArm.end, 1.0);
    makeJoint(rightArm.bend, rightArm.end, 1.0);
    leftArm.pivot.rotation.z = -0.16;
    rightArm.pivot.rotation.z = 0.16;
    const leftLeg = limb(performer, [-0.20, 1.23, 0], 0.54, 0.52, 0.11, blue);
    const rightLeg = limb(performer, [0.20, 1.23, 0], 0.54, 0.52, 0.11, blue);
    [leftLeg, rightLeg].forEach(leg => {
      const foot = mesh(new THREE.CapsuleGeometry(0.105, 0.22, 5, 12), deepBlue, leg.bend, [0, -0.55, 0.095]);
      foot.rotation.x = Math.PI / 2;
      foot.scale.x = 1.16;
    });

    // Translucent skeleton afterimages make the motion itself part of the scene.
    const poseMaterial = new THREE.LineBasicMaterial({ color: 0x398dcc, transparent: true, opacity: 0.27, depthWrite: false });
    const ghostNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x5db8eb, transparent: true, opacity: 0.35, depthWrite: false });
    const poseJoints = [
      [0, 1.24, 0], [0, 1.83, 0], [0, 2.13, 0], [0, 2.46, 0],
      [-0.43, 1.96, 0], [-0.56, 1.57, 0.20], [-0.57, 1.24, 0.46],
      [0.43, 1.96, 0], [0.56, 1.57, -0.20], [0.57, 1.24, -0.46],
      [-0.20, 1.23, 0], [-0.20, 0.71, 0.22], [-0.20, 0.18, 0.07],
      [0.20, 1.23, 0], [0.20, 0.74, -0.25], [0.20, 0.23, -0.43]
    ];
    const poseConnections = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [1, 7], [7, 8], [8, 9], [0, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15]];
    const posePoints = poseConnections.flatMap(connection => connection.map(index => new THREE.Vector3(...poseJoints[index])));
    const trace = new THREE.Group();
    trace.position.set(-1.78, 0.12, -0.16);
    trace.rotation.y = 0.28;
    trace.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(posePoints), poseMaterial));
    poseJoints.forEach(position => {
      const node = mesh(new THREE.SphereGeometry(0.039, 8, 6), ghostNodeMaterial, trace, position);
      node.castShadow = false;
      node.receiveShadow = false;
    });
    root.add(trace);
    const motionTrailMaterial = new THREE.LineBasicMaterial({ color: 0x4ea9df, transparent: true, opacity: 0.35 });
    [-1, 1].forEach((side, index) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.05, 1.1 + index * 0.4, -0.3),
        new THREE.Vector3(-2.48, 1.48 + index * 0.4, 0.08),
        new THREE.Vector3(-2.18, 1.91 + index * 0.4, 0.52),
        new THREE.Vector3(-1.68, 1.74 + side * 0.12, 0.78)
      ]);
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)), motionTrailMaterial));
    });

    // A friendly, attentive robot carries the intelligent-NPC narrative.
    const npc = new THREE.Group();
    npc.position.set(1.46, 0.09, -0.30);
    npc.rotation.y = 0.24;
    root.add(npc);
    roundedPlate(0.68, 0.79, 0.19, 0.39, blue, npc, [0, 1.32, -0.20]);
    roundedPlate(0.47, 0.48, 0.10, 0.035, white, npc, [0, 1.34, 0.23]);
    const chestLight = mesh(new THREE.SphereGeometry(0.085, 18, 12), cyan, npc, [0, 1.39, 0.30]);
    mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.17, 20), deepBlue, npc, [0, 1.85, 0]);
    const npcHead = new THREE.Group();
    npcHead.position.set(0, 2.16, 0);
    npc.add(npcHead);
    roundedPlate(0.94, 0.67, 0.19, 0.43, white, npcHead, [0, 0, -0.22]);
    roundedPlate(0.73, 0.40, 0.13, 0.035, deepBlue, npcHead, [0, 0, 0.245]);
    [-0.17, 0.17].forEach(x => {
      roundedPlate(0.065, 0.135, 0.030, 0.018, cyan, npcHead, [x, 0.035, 0.29]);
    });
    const smilePoints = Array.from({ length: 13 }, (_, index) => {
      const x = index / 12 * 0.18 - 0.09;
      return new THREE.Vector3(x, -0.105 + Math.pow(x / 0.09, 2) * 0.035, 0.30);
    });
    npcHead.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(smilePoints), new THREE.LineBasicMaterial({ color: 0x7ce7f3 })));
    [-0.52, 0.52].forEach(x => {
      const ear = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.13, 20), blue, npcHead, [x, 0, 0]);
      ear.rotation.z = Math.PI / 2;
    });
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12), deepBlue, npcHead, [0.25, 0.43, 0]);
    mesh(new THREE.SphereGeometry(0.055, 16, 12), cyan, npcHead, [0.25, 0.55, 0]);
    const npcLeftArm = limb(npc, [-0.43, 1.62, 0], 0.31, 0.29, 0.095, white);
    const npcRightArm = limb(npc, [0.43, 1.62, 0], 0.31, 0.29, 0.095, white);
    npcLeftArm.pivot.rotation.z = -0.25;
    npcRightArm.pivot.rotation.z = 0.94;
    npcRightArm.bend.rotation.x = -1.4;
    makeJoint(npcLeftArm.bend, npcLeftArm.end, 1.2);
    makeJoint(npcRightArm.bend, npcRightArm.end, 1.2);
    [-0.21, 0.21].forEach(x => {
      mesh(new THREE.CapsuleGeometry(0.12, 0.48, 5, 14), white, npc, [x, 0.52, 0]);
      mesh(new THREE.SphereGeometry(0.115, 16, 12), cyan, npc, [x, 0.53, 0.01]);
      const foot = mesh(new THREE.CapsuleGeometry(0.13, 0.21, 5, 14), deepBlue, npc, [x, 0.11, 0.10]);
      foot.rotation.x = Math.PI / 2;
    });
    const sensingHalo = mesh(new THREE.TorusGeometry(1.04, 0.018, 8, 96, Math.PI * 1.8), new THREE.MeshStandardMaterial({ color: 0x6cbfe9, transparent: true, opacity: 0.65, roughness: 0.4 }), npc, [0, 1.75, -0.37]);
    sensingHalo.rotation.set(0.12, -0.20, 0.2);
    sensingHalo.castShadow = false;

    const speech = new THREE.Group();
    speech.position.set(0.08, 3.02, 0.12);
    speech.rotation.y = 0.16;
    npc.add(speech);
    roundedPlate(0.98, 0.46, 0.14, 0.10, white, speech, [0, 0, 0]);
    const tail = new THREE.Shape();
    tail.moveTo(-0.25, -0.19);
    tail.lineTo(-0.22, -0.36);
    tail.lineTo(-0.02, -0.19);
    tail.closePath();
    mesh(new THREE.ExtrudeGeometry(tail, { depth: 0.10, bevelEnabled: false }), white, speech);
    const speechDots = [-0.22, 0, 0.22].map(x => mesh(new THREE.SphereGeometry(0.046, 14, 10), blue, speech, [x, 0, 0.14]));
    const thought = new THREE.Group();
    npc.add(thought);
    const thoughtPositions = [[-0.67, 2.79, -0.32], [-0.46, 3.25, -0.36], [0.21, 3.58, -0.32], [0.70, 3.27, -0.24]];
    const thoughtPoints = thoughtPositions.map(position => new THREE.Vector3(...position));
    const thoughtLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(thoughtPoints), new THREE.LineBasicMaterial({ color: 0x71acd3, transparent: true, opacity: 0.5 }));
    thought.add(thoughtLine);
    thoughtPositions.forEach((position, index) => {
      const node = mesh(new THREE.SphereGeometry(index === 2 ? 0.078 : 0.047, 16, 12), index === 2 ? cyan : blue, thought, position);
      node.castShadow = false;
    });

    // Shallow display plinths and a fine grid anchor both characters.
    mesh(new THREE.CylinderGeometry(3.05, 3.12, 0.22, 96), ice, root, [0, -0.25, 0]);
    mesh(new THREE.CylinderGeometry(2.98, 3.05, 0.09, 96), white, root, [0, -0.095, 0]);
    const platformRing = mesh(new THREE.TorusGeometry(3.035, 0.025, 8, 128), blue, root, [0, -0.14, 0]);
    platformRing.rotation.x = Math.PI / 2;
    const insetRing = mesh(new THREE.TorusGeometry(2.72, 0.012, 6, 128), ringMaterial, root, [0, -0.043, 0]);
    insetRing.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(1.43, 1.5, 0.12, 64), white, root, [-1.22, 0.025, 0.48]);
    mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.07, 64), ice, root, [1.46, 0.015, -0.30]);
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.12 }));
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.57;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);
    const grid = new THREE.GridHelper(20, 40, 0xc5d9ee, 0xc5d9ee);
    grid.position.y = -0.58;
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.material.depthWrite = false;
    scene.add(grid);

    const orbitPoints = Array.from({ length: 97 }, (_, index) => {
      const angle = index / 96 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * 2.78, 1.6 + Math.sin(angle) * 0.78, Math.sin(angle) * 1.7);
    });
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineBasicMaterial({ color: 0x6ba8dc, transparent: true, opacity: 0.42 })));
    const electron = mesh(new THREE.SphereGeometry(0.065, 12, 8), cyan);
    electron.castShadow = false;
    const satellites = new THREE.Group();
    root.add(satellites);
    [[-2.75, 2.8, -0.7, 0.12], [2.85, 1.35, 1.0, 0.16], [-0.25, 3.65, -0.9, 0.09], [2.25, 0.9, -1.8, 0.1], [-2.35, 0.8, -1.9, 0.11]].forEach(([x, y, z, size], index) => {
      const satellite = mesh(new THREE.BoxGeometry(size, size, size), index % 2 ? cyan : ice, satellites, [x, y, z]);
      satellite.rotation.set(0.4, index * 0.6, 0.5);
      satellite.castShadow = false;
    });

    const updatePauseButton = () => {
      if (!pauseButton) return;
      pauseButton.setAttribute('aria-pressed', String(paused));
      const label = paused ? pauseButton.dataset.resumeLabel : pauseButton.dataset.pauseLabel;
      if (label) {
        pauseButton.setAttribute('aria-label', label);
        pauseButton.title = label;
      }
    };
    const canRender = () => !failed && visible && !document.hidden;
    const wake = (frames = 1) => {
      settling = Math.max(settling, frames);
      if (!frame && canRender()) frame = requestAnimationFrame(render);
    };
    function render(time) {
      frame = 0;
      if (!canRender()) return;
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      if (!paused) phase += delta;
      root.rotation.y = -0.18 + yaw + Math.sin(phase * 0.24) * 0.055;
      root.rotation.x = pitch;
      const stride = phase * 2.4 + 0.7;
      const step = Math.sin(stride);
      performer.position.y = 0.12 + Math.sin(stride * 2) * 0.024;
      leftLeg.pivot.rotation.x = step * 0.42;
      rightLeg.pivot.rotation.x = -step * 0.42;
      leftLeg.bend.rotation.x = 0.12 + Math.max(0, -step) * 0.43;
      rightLeg.bend.rotation.x = 0.12 + Math.max(0, step) * 0.43;
      leftArm.pivot.rotation.x = -step * 0.45;
      rightArm.pivot.rotation.x = step * 0.45;
      leftArm.bend.rotation.x = -0.40 - Math.max(0, step) * 0.25;
      rightArm.bend.rotation.x = -0.40 - Math.max(0, -step) * 0.25;
      npcHead.rotation.z = Math.sin(phase * 0.8) * 0.035;
      npcRightArm.pivot.rotation.z = 0.94 + Math.sin(phase * 1.8) * 0.08;
      sensingHalo.rotation.z = 0.2 + Math.sin(phase * 0.55) * 0.10;
      speech.position.y = 3.02 + Math.sin(phase * 1.1) * 0.035;
      speechDots.forEach((dot, index) => { dot.position.y = Math.sin(phase * 2.2 - index * 0.7) * 0.024; });
      chestLight.material.emissiveIntensity = 0.28 + Math.sin(phase * 1.4) * 0.05;
      satellites.rotation.y = Math.sin(phase * 0.19) * 0.07;
      const angle = phase * 0.36 + 1;
      electron.position.set(Math.cos(angle) * 2.78, 1.6 + Math.sin(angle) * 0.78, Math.sin(angle) * 1.7);
      const parallax = reducedMotion.matches ? 0 : 1;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraOrigin.x + pointer.x * 0.4 * parallax, 0.09);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraOrigin.y - pointer.y * 0.24 * parallax, 0.09);
      camera.lookAt(lookAt);
      try { renderer.render(scene, camera); }
      catch { fallback(); return; }
      if (settling > 0) settling--;
      if (!paused || settling > 0) frame = requestAnimationFrame(render);
    }
    const resize = () => {
      if (failed) return;
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.35 : 1.7));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = width / height < 0.9 ? 39 : 35;
      camera.updateProjectionMatrix();
      wake();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        lastTime = 0;
        if (visible) wake();
        else { cancelAnimationFrame(frame); frame = 0; }
      }, { rootMargin: '40px' });
      visibilityObserver.observe(host);
    }
    canvas.addEventListener('pointerdown', event => {
      if (failed || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
      canvas.setPointerCapture(event.pointerId);
      hero.dataset.sceneDragging = 'true';
    });
    canvas.addEventListener('pointermove', event => {
      if (failed) return;
      if (drag?.id === event.pointerId) {
        yaw = drag.yaw + (event.clientX - drag.x) * 0.007;
        pitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * 0.002, -0.18, 0.24);
      } else if (event.pointerType === 'mouse') {
        const bounds = host.getBoundingClientRect();
        pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        pointer.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      }
      wake(32);
    }, { passive: true });
    const endDrag = event => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      delete hero.dataset.sceneDragging;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', () => { drag = null; delete hero.dataset.sceneDragging; });
    canvas.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; wake(32); });
    pauseButton?.addEventListener('click', () => {
      if (failed) return;
      paused = !paused;
      updatePauseButton();
      wake();
    });
    resetButton?.addEventListener('click', () => {
      if (failed) return;
      yaw = pitch = phase = 0;
      pointer.x = pointer.y = 0;
      camera.position.copy(cameraOrigin);
      wake();
    });
    reducedMotion.addEventListener('change', () => {
      if (failed) return;
      paused = reducedMotion.matches;
      pointer.x = pointer.y = 0;
      updatePauseButton();
      wake();
    });
    document.addEventListener('visibilitychange', () => {
      if (failed) return;
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (!document.hidden) wake();
    });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });

    // Only replace the CSS fallback after a complete initial draw.
    resize();
    renderer.render(scene, camera);
    hero.dataset.sceneState = 'ready';
    if (controls) controls.hidden = false;
    updatePauseButton();
    wake();
  } catch { fallback(); }
}
