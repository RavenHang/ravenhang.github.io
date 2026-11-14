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
  const thoughtWrap = hero.querySelector('[data-scene-thought-wrap]');
  const thoughtText = hero.querySelector('[data-scene-thought]');
  const modeControls = hero.querySelector('[data-animation-modes]');
  const modeButtons = [...hero.querySelectorAll('[data-animation-mode]')];
  const modeDescription = hero.querySelector('[data-animation-description]');
  const modeSettings = {
    state: { transition: 0 },
    blend: { transition: 0.60 },
    matching: { transition: 0.32 },
    generative: { transition: 0.38 }
  };
  let animationMode = 'matching';
  const actions = ['explore', 'peck', 'greet', 'jump', 'spin', 'defend', 'balance', 'stretch'];
  const actionMetadata = {
    explore: { duration: 6.4, representativeTime: 3.10 },
    peck: { duration: 3.8, representativeTime: 1.80 },
    greet: { duration: 3.6, representativeTime: 1.35 },
    jump: { duration: 3.3, representativeTime: 1.06 },
    spin: { duration: 3.8, representativeTime: 1.75 },
    defend: { duration: 3.5, representativeTime: 1.15 },
    balance: { duration: 4.2, representativeTime: 1.95 },
    stretch: { duration: 4.1, representativeTime: 1.80 }
  };
  const representativeTimes = Object.fromEntries(actions.map(action => [action, actionMetadata[action].representativeTime]));
  const thinkingDuration = 1200;
  let selectedAction = null;
  let actionIndex = -1;
  let reactionState = 'idle';
  let actionElapsed = 0;
  let thinkingTimer = 0;
  let reactionVersion = 0;
  let spokenThought = null;
  let voiceVersion = 0;
  let thinkingAudio;
  try {
    const language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
    thinkingAudio = new Audio(new URL(`../audio/bot-thinking-${language}.mp3`, import.meta.url));
    thinkingAudio.preload = 'auto';
  } catch { /* Browser speech remains available when audio cannot be created. */ }
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

  const stopSpeech = () => {
    voiceVersion++;
    if (thinkingAudio) {
      try { thinkingAudio.pause(); thinkingAudio.currentTime = 0; } catch { /* Optional audio. */ }
    }
    try { window.speechSynthesis?.cancel(); } catch { /* Speech is optional. */ }
    spokenThought = null;
  };
  const fallback = () => {
    if (failed) return;
    failed = true;
    cancelAnimationFrame(frame);
    clearTimeout(thinkingTimer);
    reactionVersion++;
    stopSpeech();
    hero.dataset.sceneState = 'fallback';
    if (controls) controls.hidden = true;
    if (thoughtWrap) thoughtWrap.hidden = true;
    if (modeControls) modeControls.hidden = true;
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
    canvas.setAttribute('role', 'button');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', host.dataset.botLabel || 'Click the Bot to make it think and act');
    canvas.style.cursor = 'pointer';
    canvas.style.touchAction = 'pan-y';
    host.appendChild(canvas);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xeef6ff, 16, 32);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    const cameraOrigin = new THREE.Vector3(5, 3.7, 8.4);
    const lookAt = new THREE.Vector3(0, 1.60, 0);
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

    const feather = new THREE.MeshStandardMaterial({ color: 0xb1bdc7, roughness: 0.82 });
    const breast = new THREE.MeshStandardMaterial({ color: 0xd4dade, roughness: 0.88 });
    const wingGray = new THREE.MeshStandardMaterial({ color: 0x929faa, roughness: 0.88 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x48515c, roughness: 0.78 });
    const collar = new THREE.MeshStandardMaterial({ color: 0x749b94, roughness: 0.50, metalness: 0.12 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfffae8, roughness: 0.48 });
    const iris = new THREE.MeshStandardMaterial({ color: 0xf29940, roughness: 0.50 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x202831, roughness: 0.42 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xd88e97, roughness: 0.80 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf5f7f5, roughness: 0.85 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xcbd7de, roughness: 0.94, flatShading: true });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x77a9bb, roughness: 0.65 });
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

    const sphereGeometry = new THREE.SphereGeometry(1, 24, 18);
    const ellipsoid = (parent, material, position, scale) => {
      const object = mesh(sphereGeometry, material, parent, position);
      object.scale.set(...scale);
      return object;
    };
    const axis = new THREE.Vector3(0, 1, 0);
    const rod = (parent, from, to, radius, material) => {
      const a = new THREE.Vector3(...from);
      const b = new THREE.Vector3(...to);
      const object = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 10), material, parent, a.clone().add(b).multiplyScalar(0.5).toArray());
      object.quaternion.setFromUnitVectors(axis, b.sub(a).normalize());
      return object;
    };

    // A round, slightly bewildered pigeon. Its neck really becomes the rotor arm.
    const character = new THREE.Group();
    character.position.set(0, 0, 0.08);
    character.rotation.y = -0.55;
    root.add(character);
    const body = new THREE.Group();
    body.position.y = 1.00;
    character.add(body);
    ellipsoid(body, feather, [0, 0, 0], [0.64, 0.78, 0.62]);
    ellipsoid(body, breast, [0, -0.07, 0.23], [0.56, 0.63, 0.49]);
    ellipsoid(body, collar, [0, 0.51, 0.14], [0.35, 0.30, 0.32]);
    const wings = [-1, 1].map(side => {
      const wing = new THREE.Group();
      wing.position.set(side * 0.52, 0.15, -0.04);
      wing.rotation.z = side * 0.10;
      body.add(wing);
      ellipsoid(wing, wingGray, [side * 0.055, -0.20, -0.04], [0.23, 0.57, 0.42]);
      [-0.02, -0.24].forEach(z => {
        const bar = ellipsoid(wing, charcoal, [side * 0.285, -0.20, z], [0.045, 0.34, 0.060]);
        bar.rotation.x = -0.35;
      });
      return wing;
    });
    const tail = new THREE.Group();
    tail.position.set(0, -0.38, -0.51);
    tail.rotation.x = -0.15;
    body.add(tail);
    for (let index = -2; index <= 2; index++) {
      const plume = ellipsoid(tail, index % 2 ? charcoal : wingGray, [index * 0.105, 0, -0.28], [0.093, 0.065, 0.43]);
      plume.rotation.y = index * 0.10;
    }
    const feet = [-1, 1].map(side => {
      const foot = new THREE.Group();
      foot.position.set(side * 0.24, -0.54, 0.055);
      body.add(foot);
      rod(foot, [0, 0, 0], [0, -0.30, 0.035], 0.041, pink);
      for (let toe = -1; toe <= 1; toe++) {
        rod(foot, [0, -0.30, 0.035], [toe * 0.11, -0.335, 0.31 - Math.abs(toe) * 0.05], 0.027, pink);
      }
      rod(foot, [0, -0.30, 0.035], [0, -0.335, -0.10], 0.023, pink);
      return foot;
    });
    const neckSegments = Array.from({ length: 6 }, (_, index) => mesh(new THREE.CylinderGeometry(0.155, 0.178, 1, 18), index < 2 ? collar : feather, character));
    const neckJoints = Array.from({ length: 5 }, (_, index) => ellipsoid(character, index < 2 ? collar : feather, [0, 0, 0], [0.17, 0.17, 0.17]));
    const head = new THREE.Group();
    character.add(head);
    ellipsoid(head, feather, [0, 0, 0], [0.34, 0.36, 0.33]);
    const eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(side * 0.235, 0.055, 0.205);
      eye.rotation.y = side * 0.18;
      head.add(eye);
      ellipsoid(eye, eyeWhite, [0, 0, 0], [0.148, 0.157, 0.122]);
      ellipsoid(eye, iris, [side * 0.008, 0, 0.105], [0.083, 0.086, 0.036]);
      ellipsoid(eye, pupil, [side * 0.008, 0, 0.137], [0.044, 0.052, 0.018]);
      ellipsoid(eye, white, [side * 0.008 - 0.016, 0.027, 0.154], [0.018, 0.021, 0.009]);
      return eye;
    });
    const beak = mesh(new THREE.ConeGeometry(0.083, 0.29, 16), charcoal, head, [0, -0.065, 0.39]);
    beak.rotation.x = Math.PI / 2;
    ellipsoid(head, eyeWhite, [0, -0.010, 0.298], [0.108, 0.071, 0.075]);
    const setNeck = endpoint => {
      const base = new THREE.Vector3(0, 1.42, 0.13);
      const bend = new THREE.Vector3(endpoint.x * 0.22, Math.max(1.48, endpoint.y + 0.10), 0.15 + (endpoint.z - 0.15) * 0.20);
      const curve = new THREE.QuadraticBezierCurve3(base, bend, endpoint);
      neckSegments.forEach((segment, index) => {
        const a = curve.getPoint(index / neckSegments.length);
        const b = curve.getPoint((index + 1) / neckSegments.length);
        segment.position.copy(a).add(b).multiplyScalar(0.5);
        segment.scale.set(1, a.distanceTo(b) + 0.055, 1);
        segment.quaternion.setFromUnitVectors(axis, b.sub(a).normalize());
        if (index < neckJoints.length) neckJoints[index].position.copy(curve.getPoint((index + 1) / neckSegments.length));
      });
      head.position.copy(endpoint);
    };
    const rotor = new THREE.Group();
    rotor.position.set(0, 2.13, 0.16);
    character.add(rotor);
    const rotorMaterial = new THREE.MeshBasicMaterial({ color: 0x99aeb9, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    [0, Math.PI].forEach(turn => {
      const arc = mesh(new THREE.TorusGeometry(0.94, 0.048, 6, 64, Math.PI * 0.70), rotorMaterial, rotor);
      arc.rotation.set(Math.PI / 2, 0, turn);
      arc.castShadow = false;
      arc.receiveShadow = false;
    });
    rotor.visible = false;

    // A pale stone perch keeps the joke readable without a laboratory display.
    mesh(new THREE.CylinderGeometry(1.72, 1.28, 0.47, 7), stone, root, [0, -0.28, 0]);
    mesh(new THREE.CylinderGeometry(1.78, 1.73, 0.12, 7), white, root, [0, 0.015, 0]);
    [[-1.15, -0.60], [1.08, -0.46], [1.12, 0.60]].forEach(([x, z], index) => {
      const pebble = mesh(new THREE.DodecahedronGeometry(0.15 + index * 0.025, 0), stone, root, [x, 0.14, z]);
      pebble.scale.set(1.2, 0.50, 0.85);
      pebble.rotation.y = index;
    });
    [[-1.21, -0.64, 0.40], [1.13, -0.69, -0.42]].forEach(([x, y, z], index) => {
      const fragment = mesh(new THREE.DodecahedronGeometry(0.14, 0), stone, root, [x, y, z]);
      fragment.rotation.set(0.3, index, 0.5);
    });
    const landingMaterial = new THREE.MeshBasicMaterial({ color: 0x8aacbc, transparent: true, opacity: 0, depthWrite: false });
    const landingRing = mesh(new THREE.TorusGeometry(0.64, 0.022, 6, 48), landingMaterial, root, [0, 0.084, 0.08]);
    landingRing.rotation.x = Math.PI / 2;
    landingRing.castShadow = false;
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.10 }));
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.94;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);

    // A small authored feature search, inspired by classic Motion Matching:
    // current pose / velocity + desired future trajectory -> nearest clip -> crossfade.
    // This is a procedural homage, not a motion-capture database or learned model.
    // Primary explanation: https://www.ubisoft.com/en-us/studio/laforge/news/6xXL85Q3bF2vEj76xmnmIu/introducing-learned-motion-matching
    const futurePath = (x, z) => [x * 0.30, z * 0.30, x * 0.65, z * 0.65, x, z];
    const motionSpecs = [
      { action: 'explore', target: [0.46, 0.85], pose: [0, 0.10, 0], velocity: [0, 0.4, 0] },
      { action: 'peck', target: [0, 0.28], pose: [0, 0, 0.12], velocity: [0, 0.2, 0.2] },
      { action: 'greet', target: [0, 0], pose: [0, 0.10, 0], velocity: [0, 0.2, 0.1] },
      { action: 'jump', target: [0, 0.12], pose: [0.1, 0.1, 0], velocity: [0.8, 0.3, 0.1] },
      { action: 'spin', target: [0, 0], pose: [0.04, 0.1, 0.1], velocity: [0, 0.3, 0.8] },
      { action: 'defend', target: [0, -0.25], pose: [-0.1, 0.1, -0.1], velocity: [-0.1, 0.4, 0.3] },
      { action: 'balance', target: [0, 0], pose: [0, 0.15, 0.1], velocity: [0, 0.2, 0.4] },
      { action: 'stretch', target: [0, 0], pose: [0, 0.25, 0], velocity: [0, 0.6, 0.1] }
    ];
    const motionLibrary = motionSpecs.flatMap(spec => [-1, 1].map(turn => ({
      id: `pigeon-${spec.action}-${turn < 0 ? 'left' : 'right'}`,
      action: spec.action,
      path: futurePath(spec.target[0] * turn, spec.target[1]),
      pose: spec.pose.map((value, index) => index === 1 ? value * turn : value),
      velocity: spec.velocity.map((value, index) => index === 1 ? value * turn : value),
      turn,
      amplitude: turn < 0 ? 0.95 : 1.02,
      speed: 1
    })));
    let selectedMotion = motionLibrary[0];
    const poseNodes = [character, body, head, ...wings, ...feet, ...neckSegments, ...neckJoints, ...eyes];
    const capturePose = () => poseNodes.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    let transitionFrom = null;
    let transitionTime = 0;
    let idlePose = null;
    const beginTransition = () => {
      transitionFrom = paused || animationMode === 'state' ? null : capturePose();
      transitionTime = 0;
    };
    const poseFeatures = () => [character.position.y, head.position.x, body.rotation.z];
    let previousFeatures = poseFeatures();
    let poseVelocity = [0, 0, 0];
    const squaredDistance = (a, b) => a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
    const matchMotion = action => {
      const turn = Math.floor((reactionVersion - 1) / actions.length) % 2 ? 0.46 : -0.46;
      const spec = motionSpecs.find(item => item.action === action);
      const desiredPath = futurePath(spec.target[0] * Math.sign(turn), spec.target[1]);
      const currentPose = poseFeatures();
      const currentVelocity = poseVelocity.map(value => THREE.MathUtils.clamp(value, -1.5, 1.5));
      let winner;
      let lowestCost = Infinity;
      motionLibrary.forEach(candidate => {
        const cost = (candidate.action === action ? 0 : 100)
          + squaredDistance(candidate.path, desiredPath) * 2.4
          + squaredDistance(candidate.pose, currentPose) * 0.40
          + squaredDistance(candidate.velocity, currentVelocity) * 0.12;
        if (cost < lowestCost) { lowestCost = cost; winner = candidate; }
      });
      hero.dataset.motionClip = winner.id;
      selectedMotion = winner;
      updateTrajectory(winner.path);
    };
    // The generative stage samples a seeded procedural grammar. It does not use
    // a trained model, a text-to-motion service, or any external inference API.
    const seededRandom = initialSeed => {
      let seed = initialSeed >>> 0;
      return () => {
        seed += 0x6d2b79f5;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
      };
    };
    const selectMotion = action => {
      if (animationMode === 'matching') {
        matchMotion(action);
        selectedMotion = { ...selectedMotion };
      } else {
        // The state and blend examples deliberately use a fixed authored clip.
        selectedMotion = { ...motionLibrary.find(motion => motion.action === action) };
        if (animationMode === 'generative') {
          const seed = (Math.imul(reactionVersion, 2654435761) + Math.imul(actionIndex + 1, 1013904223)) >>> 0;
          const random = seededRandom(seed);
          const durationScale = 0.85 + random() * 0.30;
          Object.assign(selectedMotion, {
            id: `procedural-${action}-${seed}`,
            speed: 1 / durationScale,
            amplitude: 0.84 + random() * 0.29,
            pathScale: 0.82 + random() * 0.30,
            phaseOffset: random() * Math.PI * 2,
            gaitAccent: 0.78 + random() * 0.45,
            headAccent: 0.84 + random() * 0.30,
            wingAccent: 0.82 + random() * 0.32,
            turn: random() < 0.5 ? -1 : 1
          });
          selectedMotion.path = selectedMotion.path.map((value, index) => index % 2
            ? value * selectedMotion.pathScale
            : Math.abs(value) * selectedMotion.turn * selectedMotion.pathScale);
          hero.dataset.motionSeed = String(seed);
        } else delete hero.dataset.motionSeed;
      }
      selectedMotion.duration = actionMetadata[action].duration / selectedMotion.speed;
      hero.dataset.motionClip = selectedMotion.id;
      updateTrajectory(selectedMotion.path);
    };
    const trajectory = new THREE.Group();
    const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x54a5db, transparent: true, opacity: 0.65 });
    const trajectoryLine = new THREE.Line(new THREE.BufferGeometry(), trajectoryMaterial);
    trajectory.add(trajectoryLine);
    const trajectoryDots = Array.from({ length: 3 }, () => {
      const dot = mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.012, 16), cyan, trajectory);
      dot.castShadow = false;
      return dot;
    });
    trajectory.visible = false;
    root.add(trajectory);
    function updateTrajectory(path) {
      const points = [new THREE.Vector3(0, 0.085, 0.10)];
      trajectoryDots.forEach((dot, index) => {
        dot.position.set(path[index * 2], 0.086, 0.10 + path[index * 2 + 1]);
        points.push(dot.position.clone());
      });
      const curve = new THREE.CatmullRomCurve3(points);
      trajectoryLine.geometry.dispose();
      trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(30));
    }
    const announceThought = text => {
      if (thoughtText) {
        thoughtText.setAttribute('aria-live', 'polite');
        thoughtText.textContent = text;
      }
      if (thoughtWrap) thoughtWrap.hidden = false;
    };
    const speakThinking = text => {
      stopSpeech();
      const version = voiceVersion;
      const fallbackVoice = () => {
        if (version !== voiceVersion || reactionState !== 'thinking' || document.hidden) return;
        try {
          if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
          spokenThought = new SpeechSynthesisUtterance(text.replace(/[.\u2026]+$/u, ''));
          spokenThought.lang = document.documentElement.lang.startsWith('zh') ? 'zh-CN' : 'en-US';
          spokenThought.rate = 1.02;
          window.speechSynthesis.speak(spokenThought);
        } catch { spokenThought = null; }
      };
      try {
        if (thinkingAudio) {
          const playback = thinkingAudio.play();
          playback?.catch(fallbackVoice);
        } else fallbackVoice();
      } catch { fallbackVoice(); }
    };
    const finishStaticLater = version => {
      clearTimeout(thinkingTimer);
      thinkingTimer = window.setTimeout(() => {
        thinkingTimer = 0;
        if (failed || version !== reactionVersion || !paused || reactionState !== 'acting') return;
        reactionState = 'idle';
        transitionFrom = null;
        announceThought(host.dataset.completeText || 'Unusual technique. Mission accomplished.');
        wake();
      }, 1800);
    };
    function triggerReaction() {
      if (failed || document.hidden) return;
      clearTimeout(thinkingTimer);
      const version = ++reactionVersion;
      actionIndex = (actionIndex + 1) % actions.length;
      selectedAction = actions[actionIndex];
      selectMotion(selectedAction);
      beginTransition();
      reactionState = 'thinking';
      actionElapsed = 0;
      hero.dataset.thoughtAction = selectedAction;
      hero.dataset.actionDuration = selectedMotion.duration.toFixed(3);
      hero.dataset.thoughtPhase = 'thinking';
      const text = host.dataset.thinkingText || 'I am thinking…';
      announceThought(text);
      speakThinking(text);
      wake();
      thinkingTimer = window.setTimeout(() => {
        thinkingTimer = 0;
        if (failed || version !== reactionVersion) return;
        beginTransition();
        reactionState = 'acting';
        actionElapsed = paused ? representativeTimes[selectedAction] / selectedMotion.speed : 0;
        hero.dataset.thoughtPhase = 'acting';
        const key = `thought${selectedAction[0].toUpperCase()}${selectedAction.slice(1)}`;
        announceThought(host.dataset[key] || selectedAction);
        wake();
        if (paused) finishStaticLater(version);
      }, thinkingDuration);
    }
    const smooth = (value, start, end) => THREE.MathUtils.smoothstep(value, start, end);
    const setPose = () => {
      const time = Math.min(actionMetadata[selectedAction]?.duration || 0, actionElapsed * selectedMotion.speed);
      hero.dataset.thoughtPhase = reactionState;
      hero.dataset.memePhase = reactionState;
      character.position.set(0, 0, 0.08);
      character.scale.setScalar(1);
      character.rotation.set(0, -0.55, 0);
      body.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      head.rotation.set(0, 0, 0);
      wings.forEach((wing, index) => wing.rotation.set(0, 0, (index ? 1 : -1) * 0.10));
      feet.forEach((foot, index) => {
        foot.rotation.set(0, 0, 0);
        foot.position.set((index ? 1 : -1) * 0.24, -0.54, 0.055);
      });
      eyes.forEach(eye => eye.scale.set(1, 1, 1));
      rotor.visible = false;
      landingMaterial.opacity = 0;
      landingRing.scale.setScalar(1);
      const endpoint = new THREE.Vector3(0, 2.05, 0.26);
      if (reactionState === 'idle') {
        body.scale.set(1, 1 + Math.sin(phase * 1.6) * 0.012, 1);
        endpoint.x = Math.sin(phase * 0.65) * 0.035;
        head.rotation.z = Math.sin(phase * 0.65) * 0.045;
      } else if (reactionState === 'thinking') {
        body.scale.set(1, 1, 1);
        endpoint.x = 0.15;
        endpoint.y = 2.12;
        head.rotation.z = -0.24;
        head.rotation.y = -0.12;
        eyes.forEach(eye => { eye.scale.y = 1.08; });
      } else if (selectedAction === 'explore') {
        const windup = smooth(time, 0.20, 1.55);
        const spin = smooth(time, 1.55, 2.20) * (1 - smooth(time, 4.95, 5.85));
        const lift = smooth(time, 2.15, 2.85) * (1 - smooth(time, 4.65, 5.45));
        const flightProgress = smooth(time, 2.30, 5.35);
        const orbitAngle = flightProgress * Math.PI * 2;
        const spinAngle = Math.PI / 2 + Math.max(0, time - 1.65) * (8 + smooth(time, 1.65, 2.45) * 18);
        const reach = windup * (1 - smooth(time, 5.0, 5.95));
        const radius = 0.98 * reach;
        endpoint.set(Math.sin(spinAngle) * radius, 2.05 + spin * 0.10 - windup * (1 - spin) * 0.10, 0.18 + Math.cos(spinAngle) * radius);
        if (time < 1.55) endpoint.set(windup * 1.02, 2.05 - windup * 0.13, 0.26);
        endpoint.lerp(new THREE.Vector3(0, 2.05, 0.26), smooth(time, 5.65, 6.15));
        head.rotation.set(0, spinAngle * spin, -0.35 * windup * (1 - spin));
        body.rotation.z = Math.PI * spin;
        body.rotation.x = lift * 0.10 * Math.sin(orbitAngle);
        character.position.y = lift * 1.05 * selectedMotion.amplitude;
        character.scale.setScalar(1 - lift * 0.30);
        character.position.z -= lift * 0.32;
        character.position.x = Math.sin(orbitAngle) * 0.58 * selectedMotion.turn;
        character.position.z += (1 - Math.cos(orbitAngle)) * 0.20;
        wings.forEach((wing, index) => { wing.rotation.x = Math.sin(time * 8 + index) * 0.06 * lift; });
        feet.forEach((foot, index) => { foot.rotation.x = -lift * 0.25 + Math.sin(time * 6 + index) * 0.05 * lift; });
        rotor.visible = spin > 0.12;
        rotor.rotation.y = spinAngle * 0.8;
        rotorMaterial.opacity = spin * 0.27;
        if (time > 5.05 && time < 5.90) {
          const impact = (time - 5.05) / 0.85;
          landingMaterial.opacity = (1 - impact) * 0.38;
          landingRing.scale.setScalar(1 + impact * 1.3);
          body.scale.y = 1 - Math.sin(impact * Math.PI) * 0.07;
        }
        hero.dataset.memePhase = time < 1.55 ? 'windup' : time < 2.40 ? 'rotor' : time < 4.80 ? 'flight' : 'landing';
      } else if (selectedAction === 'peck') {
        const approach = smooth(time, 0, 0.65) * (1 - smooth(time, 3.10, 3.80));
        character.position.z += approach * 0.24;
        if (time < 0.65) {
          const step = Math.sin(time * Math.PI * 4 / 0.65);
          feet[0].rotation.x = step * 0.32;
          feet[1].rotation.x = -step * 0.32;
          character.position.y += Math.abs(step) * 0.025;
        }
        const peckClock = (time - 0.65) / 0.75;
        const dip = peckClock >= 0 && peckClock < 3 ? Math.sin((peckClock % 1) * Math.PI) ** 2 : 0;
        body.rotation.x = dip * 0.22;
        endpoint.set(0, 2.05 - dip * 1.48, 0.26 + dip * 0.48);
        head.rotation.x = dip * 1.05;
        hero.dataset.memePhase = time < 0.65 ? 'step' : time < 2.90 ? 'peck' : 'recover';
      } else if (selectedAction === 'greet') {
        const wave = smooth(time, 0, 0.35) * (1 - smooth(time, 2.75, 3.60));
        wings[1].rotation.z = 0.10 + wave * (2.12 + Math.sin(time * 7) * 0.21 * selectedMotion.amplitude);
        wings[0].rotation.z = -0.10 - wave * 0.18;
        head.rotation.x = Math.sin(time * 4.2) * 0.16 * wave;
        head.rotation.z = -0.10 * wave;
        endpoint.x = Math.sin(time * 2.4) * 0.075 * wave;
        hero.dataset.memePhase = time < 2.75 ? 'wave' : 'recover';
      } else if (selectedAction === 'jump') {
        const crouch = time < 0.50 ? Math.sin(time / 0.50 * Math.PI / 2) : time > 1.65 && time < 2.15 ? Math.sin((time - 1.65) / 0.50 * Math.PI) : 0;
        body.scale.y = 1 - crouch * 0.14;
        character.position.y -= crouch * 0.065;
        endpoint.y -= crouch * 0.12;
        if (time >= 0.50 && time <= 1.65) {
          const airborne = Math.sin((time - 0.50) / 1.15 * Math.PI);
          character.position.y += airborne * 0.78 * selectedMotion.amplitude;
          wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * airborne * (1.40 + Math.sin(time * 22) * 0.20); });
          feet.forEach(foot => { foot.rotation.x = airborne * -0.30; });
        }
        if (time > 1.65 && time < 2.30) {
          const impact = (time - 1.65) / 0.65;
          landingMaterial.opacity = (1 - impact) * 0.36;
          landingRing.scale.setScalar(1 + impact * 1.2);
        }
        hero.dataset.memePhase = time < 0.50 ? 'crouch' : time < 1.65 ? 'hop' : 'landing';
      } else if (selectedAction === 'spin') {
        const turn = smooth(time, 0.45, 2.70);
        const open = smooth(time, 0, 0.45) * (1 - smooth(time, 2.80, 3.80));
        character.rotation.y += Math.PI * 2 * turn * selectedMotion.turn;
        character.position.y += Math.sin(turn * Math.PI) * 0.055;
        body.rotation.z = Math.sin(time * 7) * 0.055 * open;
        wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * (0.10 + open * 0.75); });
        head.rotation.z = Math.sin(time * 3) * 0.10 * open;
        hero.dataset.memePhase = time < 0.45 ? 'windup' : time < 2.70 ? 'twirl' : 'recover';
      } else if (selectedAction === 'defend') {
        const startled = smooth(time, 0, 0.20) * (1 - smooth(time, 0.55, 1.10));
        const cautious = smooth(time, 0, 0.35) * (1 - smooth(time, 2.65, 3.50));
        character.position.z -= cautious * 0.27;
        character.position.y -= cautious * 0.07;
        body.scale.y = 1 - cautious * 0.11;
        body.rotation.x = -startled * 0.10;
        endpoint.y = 2.05 - cautious * 0.10 + startled * 0.12;
        endpoint.z = 0.26 - cautious * 0.11;
        endpoint.x = Math.sin(Math.max(0, time - 0.65) * 2.7) * 0.15 * cautious;
        head.rotation.y = Math.sin(Math.max(0, time - 0.65) * 2.7) * 0.48 * cautious;
        wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * (0.10 + startled * 0.70); });
        eyes.forEach(eye => { eye.scale.y = 1 + startled * 0.20; });
        hero.dataset.memePhase = time < 0.65 ? 'startle' : time < 2.65 ? 'look' : 'recover';
      } else if (selectedAction === 'balance') {
        const balance = smooth(time, 0, 0.65) * (1 - smooth(time, 3.25, 4.20));
        const wobble = Math.sin(time * 4.6) * 0.12 * selectedMotion.amplitude * balance;
        character.position.x -= balance * 0.13;
        body.rotation.z = wobble;
        feet[1].position.y += balance * 0.34;
        feet[1].rotation.x = -balance * 0.70;
        wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * (0.10 + balance * 1.18) - wobble; });
        head.rotation.z = -wobble * 0.9;
        endpoint.x = -wobble * 0.45;
        hero.dataset.memePhase = time < 0.65 ? 'lift' : time < 3.25 ? 'balance' : 'recover';
      } else if (selectedAction === 'stretch') {
        const stretch = smooth(time, 0, 0.85) * (1 - smooth(time, 3.15, 4.10));
        const look = Math.sin(Math.max(0, time - 0.60) * 2.0) * stretch;
        endpoint.y += stretch * 0.57;
        endpoint.x = look * 0.53 * selectedMotion.amplitude;
        head.rotation.y = look * 0.48;
        head.rotation.z = -look * 0.13;
        wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * (0.10 + stretch * 0.18); });
        hero.dataset.memePhase = time < 0.85 ? 'extend' : time < 3.15 ? 'look' : 'recover';
      }
      if (animationMode === 'generative' && reactionState === 'acting') {
        const duration = actionMetadata[selectedAction].duration;
        const envelope = smooth(time, 0, 0.30) * (1 - smooth(time, duration - 0.45, duration));
        const generatedPhase = time * selectedMotion.gaitAccent;
        character.position.x *= selectedMotion.pathScale;
        character.position.z = 0.08 + (character.position.z - 0.08) * selectedMotion.pathScale;
        character.position.y += Math.sin(generatedPhase * 3 + selectedMotion.phaseOffset) ** 2 * 0.025 * envelope;
        endpoint.x *= selectedMotion.headAccent;
        endpoint.x += Math.sin(generatedPhase * 1.7 + selectedMotion.phaseOffset) * 0.055 * envelope;
        if (selectedAction !== 'peck') endpoint.y = 2.05 + (endpoint.y - 2.05) * selectedMotion.headAccent;
        head.rotation.y += Math.sin(generatedPhase * 2.0 + selectedMotion.phaseOffset) * 0.09 * envelope;
        body.rotation.z += Math.sin(generatedPhase * 2.8 + selectedMotion.phaseOffset) * 0.04 * envelope;
        wings.forEach((wing, index) => {
          const side = index ? 1 : -1;
          wing.rotation.z = side * 0.10 + (wing.rotation.z - side * 0.10) * selectedMotion.wingAccent;
          wing.rotation.x += Math.sin(generatedPhase * 4.5 + selectedMotion.phaseOffset + index) * 0.08 * envelope;
        });
      }
      setNeck(endpoint);
    };

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
      if (!paused) {
        phase += delta;
        transitionTime += delta;
        if (reactionState === 'acting') {
          actionElapsed += delta;
          if (actionElapsed >= selectedMotion.duration) {
            beginTransition();
            reactionState = 'idle';
            announceThought(host.dataset.completeText || 'Unusual technique. Mission accomplished.');
          }
        }
      }
      root.rotation.y = -0.12 + yaw;
      root.rotation.x = pitch;
      root.position.y = Math.sin(phase * 0.85) * 0.035;
      setPose();
      if (animationMode === 'blend' && reactionState === 'acting' && idlePose) {
        // A continuous action/idle blend plus an independent breathing/look layer.
        const envelope = smooth(actionElapsed, 0, 0.55)
          * (1 - smooth(actionElapsed, selectedMotion.duration - 0.65, selectedMotion.duration));
        const actionWeight = 0.86 * envelope;
        poseNodes.forEach((node, index) => {
          const base = idlePose[index];
          node.position.lerpVectors(base.position, node.position, actionWeight);
          // Keep multi-turn spin channels unwrapped; shortest-arc interpolation
          // against idle would flip direction as they cross 180 degrees.
          const continuousSpin = (selectedAction === 'spin' && node === character)
            || (selectedAction === 'explore' && node === head);
          if (!continuousSpin) {
            const targetRotation = node.quaternion.clone();
            node.quaternion.slerpQuaternions(base.quaternion, targetRotation, actionWeight);
          }
          node.scale.lerpVectors(base.scale, node.scale, actionWeight);
        });
        body.scale.y += Math.sin(phase * 2.0) * 0.018 * envelope;
        head.rotation.z += Math.sin(phase * 1.3) * 0.06 * envelope;
        wings.forEach((wing, index) => { wing.rotation.x += Math.sin(phase * 2.0 + index) * 0.07 * envelope; });
      }
      if (transitionFrom) {
        const progress = Math.min(1, transitionTime / modeSettings[animationMode].transition);
        const weight = progress * progress * (3 - 2 * progress);
        poseNodes.forEach((node, index) => {
          const from = transitionFrom[index];
          node.position.lerpVectors(from.position, node.position, weight);
          const targetRotation = node.quaternion.clone();
          node.quaternion.slerpQuaternions(from.quaternion, targetRotation, weight);
          node.scale.lerpVectors(from.scale, node.scale, weight);
        });
        if (progress === 1) transitionFrom = null;
      }
      const currentFeatures = poseFeatures();
      if (delta > 0 && !paused) poseVelocity = currentFeatures.map((value, index) => (value - previousFeatures[index]) / delta);
      previousFeatures = currentFeatures;
      trajectory.visible = animationMode === 'matching' && reactionState === 'thinking' && selectedAction === 'explore';
      if (thoughtWrap && reactionState === 'acting') thoughtWrap.hidden = selectedAction === 'explore' && !paused && actionElapsed * selectedMotion.speed > 2.35 && actionElapsed * selectedMotion.speed < 5.65;
      const parallax = reducedMotion.matches ? 0 : 1;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraOrigin.x + pointer.x * 0.4 * parallax, 0.09);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraOrigin.y - pointer.y * 0.24 * parallax, 0.09);
      camera.lookAt(lookAt);
      try { renderer.render(scene, camera); }
      catch { fallback(); return; }
      if (settling > 0) settling--;
      if (!paused || settling > 0) frame = requestAnimationFrame(render);
    }
    const syncAnimationMode = () => {
      hero.dataset.animationMode = animationMode;
      modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.animationMode === animationMode)));
      if (modeDescription) {
        const key = `mode${animationMode[0].toUpperCase()}${animationMode.slice(1)}Text`;
        modeDescription.textContent = host.dataset[key] || animationMode;
      }
    };
    const setAnimationMode = mode => {
      if (failed || !Object.hasOwn(modeSettings, mode)) return;
      if (animationMode === mode) { syncAnimationMode(); return; }
      clearTimeout(thinkingTimer);
      thinkingTimer = 0;
      reactionVersion++;
      stopSpeech();
      animationMode = mode;
      reactionState = 'idle';
      if (selectedAction !== null) actionIndex = (actionIndex - 1 + actions.length) % actions.length;
      selectedAction = null;
      actionElapsed = 0;
      transitionFrom = null;
      poseVelocity = [0, 0, 0];
      trajectory.visible = false;
      if (thoughtWrap) thoughtWrap.hidden = true;
      delete hero.dataset.thoughtAction;
      delete hero.dataset.actionDuration;
      delete hero.dataset.motionClip;
      delete hero.dataset.motionSeed;
      syncAnimationMode();
      setPose();
      previousFeatures = poseFeatures();
      wake();
    };
    modeButtons.forEach(button => button.addEventListener('click', () => setAnimationMode(button.dataset.animationMode)));
    const resize = () => {
      if (failed) return;
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.35 : 1.7));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = width / height < 0.9 ? 36 : 32;
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
        else { cancelAnimationFrame(frame); frame = 0; stopSpeech(); }
      }, { rootMargin: '40px' });
      visibilityObserver.observe(host);
    }
    const raycaster = new THREE.Raycaster();
    const hitPoint = new THREE.Vector2();
    const hitCharacter = event => {
      const bounds = canvas.getBoundingClientRect();
      hitPoint.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(hitPoint, camera);
      return raycaster.intersectObject(character, true).some(hit => {
        for (let object = hit.object; object; object = object.parent) {
          if (!object.visible) return false;
          if (object === character) return true;
        }
        return false;
      });
    };
    canvas.addEventListener('pointerdown', event => {
      if (failed || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, travel: 0, hit: hitCharacter(event) };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (failed) return;
      if (drag?.id === event.pointerId) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag.travel = Math.max(drag.travel, Math.hypot(dx, dy));
        if (drag.travel > 6) {
          hero.dataset.sceneDragging = 'true';
          canvas.style.cursor = 'grabbing';
          yaw = drag.yaw + dx * 0.007;
          pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.002, -0.18, 0.24);
        }
      } else if (event.pointerType === 'mouse') {
        const bounds = host.getBoundingClientRect();
        pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        pointer.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      }
      wake(32);
    }, { passive: true });
    const endDrag = event => {
      if (drag?.id !== event.pointerId) return;
      const shouldTrigger = event.type === 'pointerup' && drag.hit && drag.travel <= 6 && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= 6 && hitCharacter(event);
      drag = null;
      delete hero.dataset.sceneDragging;
      canvas.style.cursor = 'pointer';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (shouldTrigger) triggerReaction();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', () => {
      drag = null;
      delete hero.dataset.sceneDragging;
      canvas.style.cursor = 'pointer';
    });
    canvas.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; wake(32); });
    canvas.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) triggerReaction();
      }
    });
    // Assistive technologies can activate a button with a synthetic click.
    canvas.addEventListener('click', event => { if (event.detail === 0) triggerReaction(); });
    pauseButton?.addEventListener('click', () => {
      if (failed) return;
      paused = !paused;
      if (paused) stopSpeech();
      updatePauseButton();
      wake();
    });
    resetButton?.addEventListener('click', () => {
      if (failed) return;
      yaw = pitch = 0;
      pointer.x = pointer.y = 0;
      camera.position.copy(cameraOrigin);
      wake();
    });
    reducedMotion.addEventListener('change', () => {
      if (failed) return;
      paused = reducedMotion.matches;
      if (paused) {
        stopSpeech();
        transitionFrom = null;
        if (reactionState === 'acting') {
          actionElapsed = representativeTimes[selectedAction] / selectedMotion.speed;
          finishStaticLater(reactionVersion);
        }
      }
      pointer.x = pointer.y = 0;
      updatePauseButton();
      wake();
    });
    document.addEventListener('visibilitychange', () => {
      if (failed) return;
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (document.hidden) stopSpeech();
      else wake();
    });
    window.addEventListener('pagehide', () => {
      clearTimeout(thinkingTimer);
      thinkingTimer = 0;
      reactionVersion++;
      stopSpeech();
      if (reactionState === 'thinking') {
        reactionState = 'idle';
        hero.dataset.thoughtPhase = 'idle';
        transitionFrom = null;
        if (thoughtWrap) thoughtWrap.hidden = true;
      }
    });
    window.addEventListener('pageshow', () => {
      lastTime = 0;
      if (paused && reactionState === 'acting') finishStaticLater(reactionVersion);
      wake();
    });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });

    // Only replace the CSS fallback after a complete initial draw.
    hero.dataset.thoughtPhase = 'idle';
    syncAnimationMode();
    setPose();
    idlePose = capturePose();
    resize();
    renderer.render(scene, camera);
    hero.dataset.sceneState = 'ready';
    if (controls) controls.hidden = false;
    if (modeControls) modeControls.hidden = false;
    if (thoughtWrap) thoughtWrap.hidden = true;
    updatePauseButton();
    wake();
  } catch { fallback(); }
}
