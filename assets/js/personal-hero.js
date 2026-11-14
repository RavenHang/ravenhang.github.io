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
  const actions = ['explore', 'defend', 'jump', 'greet'];
  const representativeTimes = { explore: 0.32, defend: 1.1, jump: 0.82, greet: 0.65 };
  const thinkingDuration = 1200;
  const actionDuration = 4;
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

    const blue = new THREE.MeshStandardMaterial({ color: 0x1b71d2, roughness: 0.32, metalness: 0.22 });
    const deepBlue = new THREE.MeshStandardMaterial({ color: 0x174a87, roughness: 0.48, metalness: 0.12 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf9fcff, roughness: 0.28, metalness: 0.08 });
    const ice = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.28, metalness: 0.16 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x54cce9, emissive: 0x1c7eab, emissiveIntensity: 0.28, roughness: 0.28 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xf3ae43, roughness: 0.48, metalness: 0.06 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffedce, roughness: 0.60 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xafd1ec, roughness: 0.82, flatShading: true });
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

    // A single game adventurer: a hood, warm scarf, armor, boots and wrist shield.
    const character = new THREE.Group();
    character.position.set(0, 0, 0.08);
    character.rotation.y = 0.28;
    root.add(character);
    const upperBody = new THREE.Group();
    upperBody.position.y = 1.10;
    character.add(upperBody);
    roundedPlate(0.78, 0.82, 0.20, 0.43, blue, upperBody, [0, 0.48, -0.22]);
    roundedPlate(0.57, 0.53, 0.13, 0.035, white, upperBody, [0, 0.49, 0.265]);
    const crest = mesh(new THREE.OctahedronGeometry(0.105, 0), amber, upperBody, [0, 0.55, 0.345]);
    crest.scale.z = 0.38;
    roundedPlate(0.83, 0.12, 0.035, 0.47, deepBlue, character, [0, 1.09, -0.24]);
    roundedPlate(0.15, 0.13, 0.025, 0.035, amber, character, [0, 1.09, 0.29]);
    mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.18, 20), amber, upperBody, [0, 1.01, 0]);
    const scarf = new THREE.Group();
    scarf.position.set(-0.15, 1.00, -0.08);
    scarf.rotation.set(0.20, -0.35, -0.15);
    upperBody.add(scarf);
    roundedPlate(0.24, 0.64, 0.035, 0.055, amber, scarf, [-0.26, -0.29, -0.15]);
    roundedPlate(0.20, 0.47, 0.035, 0.055, amber, scarf, [-0.42, -0.19, -0.20]).rotation.z = -0.35;
    const head = new THREE.Group();
    head.position.set(0, 1.40, 0);
    upperBody.add(head);
    const hood = mesh(new THREE.SphereGeometry(0.625, 24, 16), blue, head);
    hood.scale.set(1.02, 1.03, 0.95);
    roundedPlate(0.93, 0.81, 0.27, 0.07, ice, head, [0, -0.025, 0.47]);
    roundedPlate(0.81, 0.69, 0.23, 0.06, skin, head, [0, -0.035, 0.575]);
    const eyes = [-0.18, 0.18].map(x => {
      const eye = roundedPlate(0.075, 0.145, 0.035, 0.018, deepBlue, head, [x, 0.015, 0.67]);
      mesh(new THREE.SphereGeometry(0.021, 10, 8), white, head, [x - 0.012, 0.055, 0.703]);
      return eye;
    });
    [-0.28, 0.28].forEach(x => {
      const cheek = mesh(new THREE.SphereGeometry(0.055, 12, 8), amber, head, [x, -0.11, 0.66]);
      cheek.scale.set(1, 0.43, 0.18);
    });
    const mouthPoints = Array.from({ length: 13 }, (_, index) => {
      const x = index / 12 * 0.17 - 0.085;
      return new THREE.Vector3(x, -0.17 + (x / 0.085) ** 2 * 0.035, 0.675);
    });
    head.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mouthPoints), new THREE.LineBasicMaterial({ color: 0x74565a })));
    const hoodSeam = mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 32, Math.PI), ice, head, [0, 0.26, -0.37]);
    hoodSeam.rotation.x = -0.25;
    const backpack = roundedPlate(0.56, 0.66, 0.10, 0.28, deepBlue, upperBody, [0, 0.42, -0.56]);
    backpack.rotation.x = -0.05;
    roundedPlate(0.38, 0.20, 0.045, 0.04, amber, upperBody, [0, 0.44, -0.605]);

    const limb = (parent, position, upperLength, lowerLength, radius, armor) => {
      const pivot = new THREE.Group();
      pivot.position.set(...position);
      parent.add(pivot);
      mesh(new THREE.SphereGeometry(radius * 1.10, 16, 12), deepBlue, pivot);
      mesh(new THREE.CapsuleGeometry(radius, upperLength - radius * 2, 5, 14), armor, pivot, [0, -upperLength / 2, 0]);
      const bend = new THREE.Group();
      bend.position.y = -upperLength;
      pivot.add(bend);
      mesh(new THREE.SphereGeometry(radius * 0.9, 14, 10), deepBlue, bend);
      mesh(new THREE.CapsuleGeometry(radius * 0.90, lowerLength - radius * 1.8, 5, 14), white, bend, [0, -lowerLength / 2, 0]);
      return { pivot, bend, length: lowerLength };
    };
    const leftArm = limb(upperBody, [-0.52, 0.79, 0], 0.32, 0.33, 0.13, blue);
    const rightArm = limb(upperBody, [0.52, 0.79, 0], 0.32, 0.33, 0.13, blue);
    [leftArm, rightArm].forEach(arm => mesh(new THREE.SphereGeometry(0.135, 18, 12), skin, arm.bend, [0, -arm.length - 0.035, 0]));
    const leftLeg = limb(character, [-0.24, 1.06, 0], 0.43, 0.41, 0.16, deepBlue);
    const rightLeg = limb(character, [0.24, 1.06, 0], 0.43, 0.41, 0.16, deepBlue);
    [leftLeg, rightLeg].forEach(leg => {
      const boot = roundedPlate(0.33, 0.26, 0.075, 0.44, deepBlue, leg.bend, [0, -0.40, -0.16]);
      boot.rotation.x = 0.04;
      roundedPlate(0.34, 0.065, 0.018, 0.46, amber, leg.bend, [0, -0.51, -0.17]);
    });
    const shield = new THREE.Group();
    shield.position.set(-0.02, -0.22, 0.18);
    leftArm.bend.add(shield);
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.37);
    shieldShape.lineTo(0.31, 0.22);
    shieldShape.lineTo(0.27, -0.19);
    shieldShape.lineTo(0, -0.43);
    shieldShape.lineTo(-0.27, -0.19);
    shieldShape.lineTo(-0.31, 0.22);
    shieldShape.closePath();
    const shieldGeometry = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.08, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.02 });
    mesh(shieldGeometry, blue, shield);
    const shieldInset = mesh(shieldGeometry, white, shield, [0, 0, 0.08]);
    shieldInset.scale.set(0.80, 0.80, 0.45);
    const shieldGem = mesh(new THREE.OctahedronGeometry(0.12, 0), amber, shield, [0, -0.005, 0.15]);
    shieldGem.scale.z = 0.5;
    const guardEffect = new THREE.Group();
    guardEffect.position.set(-0.15, 1.45, 0.89);
    character.add(guardEffect);
    const guardMaterial = new THREE.MeshBasicMaterial({ color: 0x54b9f0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
    mesh(new THREE.CircleGeometry(0.82, 6), guardMaterial, guardEffect).castShadow = false;
    const guardEdge = mesh(new THREE.TorusGeometry(0.81, 0.018, 6, 6), cyan, guardEffect);
    guardEdge.castShadow = false;
    guardEffect.visible = false;

    // A small floating hex-tile island, with path stones, crystal grass and loot.
    mesh(new THREE.CylinderGeometry(1.88, 1.30, 0.55, 6), stone, root, [0, -0.38, 0]);
    mesh(new THREE.CylinderGeometry(1.94, 1.89, 0.16, 6), white, root, [0, -0.025, 0]);
    const islandEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.94, 1.89, 0.16, 6)), new THREE.LineBasicMaterial({ color: 0x86bce4 }));
    islandEdge.position.y = -0.025;
    root.add(islandEdge);
    [[-0.55, 1.12, 0.18], [-0.04, 1.38, -0.1], [0.53, 1.19, 0.16]].forEach(([x, z, turn]) => {
      const slab = mesh(new THREE.BoxGeometry(0.39, 0.035, 0.28), ice, root, [x, 0.071, z]);
      slab.rotation.y = turn;
    });
    [[-1.22, -0.45], [1.17, -0.55], [1.25, 0.66]].forEach(([x, z], index) => {
      const rock = mesh(new THREE.DodecahedronGeometry(index === 1 ? 0.26 : 0.19, 0), ice, root, [x, 0.17, z]);
      rock.scale.set(1.2, 0.65, 0.9);
      rock.rotation.y = index;
      for (let stem = 0; stem < 3; stem++) {
        const blade = mesh(new THREE.ConeGeometry(0.055, 0.32 + stem * 0.045, 3), blue, root, [x + (stem - 1) * 0.10, 0.20 + stem * 0.02, z - 0.20]);
        blade.rotation.z = (stem - 1) * -0.20;
      }
    });
    [[-1.26, -0.73, 0.46], [1.35, -0.76, -0.40], [0.23, -0.92, -0.86]].forEach(([x, y, z], index) => {
      const fragment = mesh(new THREE.DodecahedronGeometry(0.17 - index * 0.025, 0), stone, root, [x, y, z]);
      fragment.rotation.set(0.3, index, 0.5);
    });
    const loot = mesh(new THREE.OctahedronGeometry(0.16, 0), amber, root, [-1.20, 0.67, 0.46]);
    loot.scale.y = 1.35;
    const landingMaterial = new THREE.MeshBasicMaterial({ color: 0x5ab8e9, transparent: true, opacity: 0, depthWrite: false });
    const landingRing = mesh(new THREE.TorusGeometry(0.62, 0.027, 6, 48), landingMaterial, root, [0, 0.079, 0.08]);
    landingRing.rotation.x = Math.PI / 2;
    landingRing.castShadow = false;
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.10 }));
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -1.10;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);

    // A small authored feature search, inspired by classic Motion Matching:
    // current pose / velocity + desired future trajectory -> nearest clip -> crossfade.
    // This is a procedural homage, not a motion-capture database or learned model.
    // Primary explanation: https://www.ubisoft.com/en-us/studio/laforge/news/6xXL85Q3bF2vEj76xmnmIu/introducing-learned-motion-matching
    const futurePath = (x, z) => [x * 0.30, z * 0.30, x * 0.65, z * 0.65, x, z];
    const motionLibrary = [
      { id: 'explore-left', action: 'explore', path: futurePath(-0.46, 0.85), pose: [0, 0.18, 0.08], velocity: [0, 0.8, 0.45], turn: -0.18, amplitude: 0.92, speed: 0.95 },
      { id: 'explore-right', action: 'explore', path: futurePath(0.46, 0.85), pose: [0, -0.18, -0.08], velocity: [0, -0.8, -0.45], turn: 0.18, amplitude: 1.02, speed: 1.05 },
      { id: 'defend-left', action: 'defend', path: futurePath(0, 0), pose: [-0.06, -0.35, 0.12], velocity: [0, -0.2, 0], turn: -0.12, amplitude: 0.96, speed: 1 },
      { id: 'defend-right', action: 'defend', path: futurePath(0, 0), pose: [-0.06, -0.30, -0.12], velocity: [0, 0.2, 0], turn: 0.12, amplitude: 1.02, speed: 1 },
      { id: 'jump-soft', action: 'jump', path: futurePath(0, 0.12), pose: [-0.04, -0.30, 0.15], velocity: [0.2, 0.3, 0.2], turn: 0, amplitude: 0.84, speed: 0.95 },
      { id: 'jump-brisk', action: 'jump', path: futurePath(0, 0.12), pose: [0, 0.10, 0.25], velocity: [0.8, 0.9, 0.6], turn: 0, amplitude: 1, speed: 1.05 },
      { id: 'greet-calm', action: 'greet', path: futurePath(0, 0), pose: [0, 0, 0.5], velocity: [0, 0, 0.15], turn: -0.05, amplitude: 0.82, speed: 0.9 },
      { id: 'greet-bright', action: 'greet', path: futurePath(0, 0), pose: [0, 0, 1.8], velocity: [0, 0.2, 1.1], turn: 0.05, amplitude: 1.10, speed: 1.1 }
    ];
    let selectedMotion = motionLibrary[0];
    const poseNodes = [character, upperBody, head, leftArm.pivot, rightArm.pivot, leftArm.bend, rightArm.bend, leftLeg.pivot, rightLeg.pivot, leftLeg.bend, rightLeg.bend, shield, ...eyes];
    const capturePose = () => poseNodes.map(node => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    let transitionFrom = null;
    let transitionTime = 0;
    const beginTransition = () => {
      transitionFrom = paused ? null : capturePose();
      transitionTime = 0;
    };
    const poseFeatures = () => [character.position.y, leftLeg.pivot.rotation.x, rightArm.pivot.rotation.z];
    let previousFeatures = poseFeatures();
    let poseVelocity = [0, 0, 0];
    const squaredDistance = (a, b) => a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
    const matchMotion = action => {
      const turn = Math.floor((reactionVersion - 1) / actions.length) % 2 ? 0.46 : -0.46;
      const desiredPath = action === 'explore' ? futurePath(turn, 0.85) : futurePath(0, action === 'jump' ? 0.12 : 0);
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
    function triggerReaction() {
      if (failed || document.hidden) return;
      clearTimeout(thinkingTimer);
      const version = ++reactionVersion;
      actionIndex = (actionIndex + 1) % actions.length;
      selectedAction = actions[actionIndex];
      matchMotion(selectedAction);
      beginTransition();
      reactionState = 'thinking';
      actionElapsed = 0;
      hero.dataset.thoughtAction = selectedAction;
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
        actionElapsed = paused ? representativeTimes[selectedAction] : 0;
        hero.dataset.thoughtPhase = 'acting';
        const key = `thought${selectedAction[0].toUpperCase()}${selectedAction.slice(1)}`;
        announceThought(host.dataset[key] || selectedAction);
        wake();
      }, thinkingDuration);
    }
    const setPose = () => {
      const actionTime = actionElapsed * selectedMotion.speed;
      hero.dataset.thoughtPhase = reactionState;
      character.position.set(0, 0, 0.08);
      character.rotation.set(0, 0.28, 0);
      upperBody.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      leftArm.pivot.rotation.set(0, 0, -0.12);
      rightArm.pivot.rotation.set(0, 0, 0.12);
      leftArm.bend.rotation.set(-0.12, 0, 0);
      rightArm.bend.rotation.set(-0.12, 0, 0);
      leftLeg.pivot.rotation.set(0, 0, 0);
      rightLeg.pivot.rotation.set(0, 0, 0);
      leftLeg.bend.rotation.set(0.06, 0, 0);
      rightLeg.bend.rotation.set(0.06, 0, 0);
      shield.rotation.set(0, 0, 0);
      eyes.forEach(eye => { eye.scale.y = 1; });
      guardEffect.visible = false;
      landingMaterial.opacity = 0;
      if (reactionState === 'idle') {
        character.position.y += Math.sin(phase * 1.6) * 0.018;
        head.rotation.z = Math.sin(phase * 0.65) * 0.025;
        return;
      }
      if (reactionState === 'thinking') {
        head.rotation.z = -0.09;
        head.rotation.y = -0.12;
        rightArm.pivot.rotation.set(-0.75, 0, 0.28);
        rightArm.bend.rotation.x = -1.85;
        return;
      }
      if (selectedAction === 'explore') {
        const step = Math.sin(actionTime * 4.6) * selectedMotion.amplitude;
        character.position.x = Math.sin(actionTime * 0.9) * 0.28;
        character.position.y += Math.abs(step) * 0.035;
        character.rotation.y += selectedMotion.turn + Math.sin(actionTime * 1.05) * 0.25;
        leftLeg.pivot.rotation.x = step * 0.47;
        rightLeg.pivot.rotation.x = -step * 0.47;
        leftLeg.bend.rotation.x = 0.10 + Math.max(0, -step) * 0.46;
        rightLeg.bend.rotation.x = 0.10 + Math.max(0, step) * 0.46;
        leftArm.pivot.rotation.x = -step * 0.25;
        rightArm.pivot.rotation.x = step * 0.42;
        head.rotation.y = Math.sin(actionTime * 1.35) * 0.22;
        upperBody.rotation.z = step * 0.025;
      } else if (selectedAction === 'defend') {
        character.position.y -= 0.09;
        character.rotation.y = 0.12 + selectedMotion.turn;
        upperBody.rotation.x = 0.10;
        head.rotation.x = -0.08;
        leftLeg.pivot.rotation.x = -0.48;
        rightLeg.pivot.rotation.x = -0.40;
        leftLeg.bend.rotation.x = 0.85;
        rightLeg.bend.rotation.x = 0.74;
        leftArm.pivot.rotation.x = -1.08;
        leftArm.pivot.rotation.z = -0.13;
        leftArm.bend.rotation.x = -0.65;
        shield.rotation.x = 1.63;
        rightArm.pivot.rotation.x = -0.70;
        rightArm.bend.rotation.x = -0.65;
        guardEffect.visible = true;
        guardEffect.scale.setScalar(0.98 + Math.sin(actionTime * 3) * 0.035);
        guardMaterial.opacity = 0.12 + Math.sin(actionTime * 3) * 0.025;
        eyes.forEach(eye => { eye.scale.y = 0.76; });
      } else if (selectedAction === 'jump') {
        const jumpTime = actionTime % 2.6;
        if (jumpTime < 0.35 || (jumpTime > 1.25 && jumpTime < 1.60)) {
          const compression = jumpTime < 0.35 ? Math.sin(jumpTime / 0.35 * Math.PI / 2) : Math.sin((jumpTime - 1.25) / 0.35 * Math.PI);
          character.position.y -= compression * 0.10;
          leftLeg.pivot.rotation.x = rightLeg.pivot.rotation.x = -0.45 * compression;
          leftLeg.bend.rotation.x = rightLeg.bend.rotation.x = 0.84 * compression;
          upperBody.rotation.x = compression * 0.10;
        } else if (jumpTime >= 0.35 && jumpTime <= 1.25) {
          const airtime = (jumpTime - 0.35) / 0.90;
          const height = Math.sin(airtime * Math.PI);
          character.position.y += height * 0.86 * selectedMotion.amplitude;
          leftArm.pivot.rotation.z = -0.90 * height;
          rightArm.pivot.rotation.z = 1.10 * height;
          leftLeg.pivot.rotation.x = 0.20 * height;
          rightLeg.pivot.rotation.x = -0.24 * height;
          leftLeg.bend.rotation.x = 0.32 * height;
          rightLeg.bend.rotation.x = 0.45 * height;
          head.rotation.x = -0.06 * height;
        }
        if (jumpTime > 1.25 && jumpTime < 1.85) {
          const impact = (jumpTime - 1.25) / 0.60;
          landingMaterial.opacity = (1 - impact) * 0.60;
          landingRing.scale.setScalar(1 + impact * 1.4);
        }
      } else if (selectedAction === 'greet') {
        character.position.y += Math.sin(actionTime * 3) * 0.025;
        head.rotation.z = -0.10;
        rightArm.pivot.rotation.z = 2.25 + Math.sin(actionTime * 6) * 0.20 * selectedMotion.amplitude;
        rightArm.pivot.rotation.x = -0.18;
        rightArm.bend.rotation.x = -0.25;
        eyes.forEach(eye => { eye.scale.y = 0.62; });
      }
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
          if (actionElapsed >= actionDuration) {
            beginTransition();
            reactionState = 'idle';
          }
        }
      }
      root.rotation.y = -0.12 + yaw;
      root.rotation.x = pitch;
      root.position.y = Math.sin(phase * 0.85) * 0.035;
      setPose();
      if (transitionFrom) {
        const progress = Math.min(1, transitionTime / 0.32);
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
      trajectory.visible = selectedAction === 'explore' && reactionState !== 'idle';
      scarf.rotation.z = -0.15 + Math.sin(phase * 2.2) * 0.06;
      loot.rotation.y = phase * 0.70;
      loot.position.y = 0.67 + Math.sin(phase * 1.5) * 0.06;
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
        if (reactionState === 'acting') actionElapsed = representativeTimes[selectedAction];
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
    window.addEventListener('pageshow', () => { lastTime = 0; wake(); });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });

    // Only replace the CSS fallback after a complete initial draw.
    hero.dataset.thoughtPhase = 'idle';
    setPose();
    resize();
    renderer.render(scene, camera);
    hero.dataset.sceneState = 'ready';
    if (controls) controls.hidden = false;
    if (thoughtWrap) thoughtWrap.hidden = true;
    updatePauseButton();
    wake();
  } catch { fallback(); }
}
