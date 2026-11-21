import * as THREE from "three";

import bgUrl from "@/assets/garden-bg.webp";
import coupleUrl from "@/assets/couple-bench.webp";
import butterflyRedUrl from "@/assets/butterfly-red.webp";
import butterflyBlueUrl from "@/assets/butterfly-blue.webp";
import rabbitUrl from "@/assets/rabbit.webp";
import fawnUrl from "@/assets/fawn.webp";
import squirrelUrl from "@/assets/squirrel.webp";
import roseBushUrl from "@/assets/rose-bush.webp";

export type GardenHandle = {
  summonButterfly: () => void;
  dispose: () => void;
};

export type GardenOptions = {
  onReady?: () => void;
  reducedMotion?: boolean;
};

// Image aspect ratios (width / height) of the cut-out assets.
const ASPECT = {
  bg: 1920 / 1088,
  couple: 1083 / 910,
  red: 900 / 857,
  blue: 900 / 784,
  rabbit: 826 / 900,
  fawn: 553 / 900,
  squirrel: 786 / 900,
  bush: 900 / 380,
};

const GROUND = -2.4;
const BG_Z = -12;
const FOV = 35;
const LOOK_Y = -0.5;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createGardenScene(container: HTMLElement, opts: GardenOptions = {}): GardenHandle {
  const reduced = !!opts.reducedMotion;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x1c2a17);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => opts.onReady?.();
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const load = (url: string) => {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  const tex = {
    bg: load(bgUrl),
    couple: load(coupleUrl),
    red: load(butterflyRedUrl),
    blue: load(butterflyBlueUrl),
    rabbit: load(rabbitUrl),
    fawn: load(fawnUrl),
    squirrel: load(squirrelUrl),
    bush: load(roseBushUrl),
  };

  const shadowTex = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(20,25,10,0.55)");
    g.addColorStop(1, "rgba(20,25,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const cutoutMat = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.04, depthWrite: false, toneMapped: false });

  // A bottom-anchored cut-out "card" standing in the 3D garden, with a soft contact shadow.
  function cutout(map: THREE.Texture, aspect: number, height: number, shadow = 0.9) {
    const holder = new THREE.Group();
    const geo = new THREE.PlaneGeometry(height * aspect, height);
    geo.translate(0, height / 2, 0);
    const mesh = new THREE.Mesh(geo, cutoutMat(map));
    holder.add(mesh);
    if (shadow > 0) {
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(height * aspect * shadow, height * 0.35),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.01;
      holder.add(sh);
      sh.renderOrder = -1;
    }
    return { holder, mesh };
  }

  // Background garden with the rose arch
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex.bg, toneMapped: false, depthWrite: false }),
  );
  bg.position.set(0, -0.7, BG_Z);
  bg.renderOrder = -10;
  scene.add(bg);

  // Light rays
  const rayTex = canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(255,226,160,0.9)");
    g.addColorStop(1, "rgba(255,226,160,0)");
    ctx.fillStyle = g;
    const h = ctx.createLinearGradient(0, 0, s, 0);
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "destination-in";
    h.addColorStop(0, "rgba(0,0,0,0)");
    h.addColorStop(0.5, "rgba(0,0,0,1)");
    h.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, s, s);
  });
  const rays: THREE.Mesh[] = [];
  [
    { x: -6, w: 2.2, r: 0.55, o: 0.22 },
    { x: -3.8, w: 1.3, r: 0.5, o: 0.16 },
    { x: -1.2, w: 2.8, r: 0.45, o: 0.12 },
  ].forEach((cfg, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w, 16),
      new THREE.MeshBasicMaterial({
        map: rayTex,
        transparent: true,
        opacity: cfg.o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    m.position.set(cfg.x, 3, -7 + i * 0.6);
    m.rotation.z = cfg.r;
    m.userData["base"] = cfg.o;
    rays.push(m);
    scene.add(m);
  });

  // Couple on the bench
  const couple = cutout(tex.couple, ASPECT.couple, 3.3, 0.85);
  couple.holder.position.set(0, GROUND, 0);
  scene.add(couple.holder);

  // Animals
  type Animal = {
    holder: THREE.Group;
    mesh: THREE.Mesh;
    baseY: number;
    hopAt: number;
    hopDur: number;
    hopHeight: number;
    kind: "rabbit" | "fawn" | "squirrel";
    phase: number;
  };
  const animals: Animal[] = [];
  const addAnimal = (
    kind: Animal["kind"],
    x: number,
    z: number,
    h: number,
    mirror: boolean,
  ) => {
    const map = tex[kind];
    const c = cutout(map, ASPECT[kind], h, kind === "fawn" ? 1.4 : 1.1);
    c.holder.position.set(x, GROUND, z);
    if (mirror) c.mesh.scale.x = -1;
    scene.add(c.holder);
    const a: Animal = {
      holder: c.holder,
      mesh: c.mesh,
      baseY: GROUND,
      hopAt: -10,
      hopDur: kind === "fawn" ? 0.8 : 0.55,
      hopHeight: kind === "fawn" ? 0.25 : kind === "squirrel" ? 0.45 : 0.4,
      kind,
      phase: Math.random() * 10,
    };
    c.mesh.userData["animal"] = a;
    animals.push(a);
  };
  addAnimal("fawn", -3.1, -1.4, 2.0, false);
  addAnimal("rabbit", -1.95, 1.5, 0.95, false);
  addAnimal("rabbit", 2.55, 1.2, 0.85, true);
  addAnimal("squirrel", 3.55, 0.2, 0.9, true);
  addAnimal("rabbit", -4.1, 2.3, 0.8, false);
  addAnimal("fawn", 4.6, -2.2, 1.7, true);

  // Rose bushes (mid + foreground)
  const bushes: { mesh: THREE.Group; phase: number }[] = [];
  const addBush = (x: number, y: number, z: number, h: number, mirror = false) => {
    const c = cutout(tex.bush, ASPECT.bush, h, 0);
    c.holder.position.set(x, y, z);
    if (mirror) c.mesh.scale.x = -1;
    scene.add(c.holder);
    bushes.push({ mesh: c.holder, phase: Math.random() * 6 });
  };
  addBush(-5.6, GROUND - 0.3, -3.5, 1.7);
  addBush(5.8, GROUND - 0.3, -3.2, 1.6, true);
  addBush(-4.6, GROUND - 1.25, 3.4, 1.5);
  addBush(4.9, GROUND - 1.3, 3.6, 1.6, true);

  // Butterflies
  type Butterfly = {
    group: THREE.Group;
    tilt: THREE.Group;
    left: THREE.Mesh;
    right: THREE.Mesh;
    c: THREE.Vector3;
    amp: THREE.Vector3;
    freq: THREE.Vector3;
    ph: THREE.Vector3;
    flap: number;
    flapPhase: number;
    yaw: number;
    mode: "wander" | "approach" | "hover" | "return";
    modeT: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    face: number;
    timeScale: number;
  };
  const butterflies: Butterfly[] = [];
  const wingMats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
  const makeButterfly = (map: THREE.Texture, aspect: number, size: number) => {
    let mat = wingMats.get(map);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      wingMats.set(map, mat);
    }
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    group.add(tilt);
    const w = size;
    const h = size / aspect;
    const wing = (side: -1 | 1) => {
      const geo = new THREE.PlaneGeometry(w / 2, h);
      geo.translate((side * w) / 4, 0, 0);
      const uv = geo.attributes["uv"] as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        uv.setX(i, side < 0 ? u * 0.5 : 0.5 + u * 0.5);
      }
      return new THREE.Mesh(geo, mat);
    };
    const left = wing(-1);
    const right = wing(1);
    tilt.add(left, right);
    scene.add(group);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const b: Butterfly = {
      group,
      tilt,
      left,
      right,
      c: new THREE.Vector3(rnd(-3, 3), rnd(0, 2), rnd(-3, 2)),
      amp: new THREE.Vector3(rnd(2.5, 4.5), rnd(0.6, 1.4), rnd(1.2, 2.5)),
      freq: new THREE.Vector3(rnd(0.12, 0.22), rnd(0.3, 0.6), rnd(0.18, 0.32)),
      ph: new THREE.Vector3(rnd(0, 6), rnd(0, 6), rnd(0, 6)),
      flap: rnd(13, 18),
      flapPhase: rnd(0, 6),
      yaw: 0,
      mode: "wander",
      modeT: 0,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      face: 0,
      timeScale: 1,
    };
    left.userData["butterfly"] = b;
    right.userData["butterfly"] = b;
    butterflies.push(b);
    return b;
  };
  const hero = makeButterfly(tex.red, ASPECT.red, 0.75);
  makeButterfly(tex.red, ASPECT.red, 0.6);
  for (let i = 0; i < (reduced ? 4 : 8); i++) makeButterfly(tex.blue, ASPECT.blue, 0.42 + Math.random() * 0.16);

  const wanderPos = (b: Butterfly, t: number, out: THREE.Vector3) =>
    out.set(
      b.c.x + b.amp.x * Math.sin(t * b.freq.x + b.ph.x),
      b.c.y + b.amp.y * Math.sin(t * b.freq.y + b.ph.y),
      b.c.z + b.amp.z * Math.sin(t * b.freq.z + b.ph.z),
    );

  // Falling rose petals
  const petalTex = canvasTexture(64, (ctx, s) => {
    ctx.translate(s / 2, s / 2);
    const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(235,225,225,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.42, -s * 0.3, s * 0.32, s * 0.32, 0, s * 0.42);
    ctx.bezierCurveTo(-s * 0.32, s * 0.32, -s * 0.42, -s * 0.3, 0, -s * 0.42);
    ctx.fill();
  });
  const PETALS = reduced ? 50 : 140;
  const petals = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({
      map: petalTex,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
    PETALS,
  );
  const petalColors = [0xf4a6b0, 0xe96a7a, 0xb3263c, 0xfbd0d5, 0x8d1f33];
  const petalData = Array.from({ length: PETALS }, (_, i) => {
    petals.setColorAt(i, new THREE.Color(petalColors[i % petalColors.length]));
    return {
      x: (Math.random() - 0.5) * 18,
      y: Math.random() * 10 - 3,
      z: Math.random() * 11 - 6,
      speed: 0.25 + Math.random() * 0.35,
      sway: Math.random() * 6,
      spin: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2),
      s: 0.7 + Math.random() * 0.8,
    };
  });
  scene.add(petals);

  // Golden dust motes
  const DUST = reduced ? 80 : 220;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = Math.random() * 7 - 2.5;
    dustPos[i * 3 + 2] = Math.random() * 10 - 7;
    dustSeed[i] = Math.random() * 100;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dotTex = canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,236,180,1)");
    g.addColorStop(0.4, "rgba(255,220,140,0.45)");
    g.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  const dustMat = new THREE.PointsMaterial({
    map: dotTex,
    size: 0.09,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  const dustBase = dustPos.slice();

  // Hearts that float up when the couple is tapped
  const heartTex = canvasTexture(128, (ctx, s) => {
    ctx.translate(s / 2, s / 2 + 6);
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, "#ff8fa3");
    g.addColorStop(1, "#c81d45");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,180,190,0.9)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.bezierCurveTo(-60, -6, -30, -58, 0, -26);
    ctx.bezierCurveTo(30, -58, 60, -6, 0, 34);
    ctx.fill();
  });
  type Heart = { sprite: THREE.Sprite; t: number; life: number; vx: number; x0: number; active: boolean };
  const hearts: Heart[] = Array.from({ length: 24 }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0 }),
    );
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, t: 0, life: 2.6, vx: 0, x0: 0, active: false };
  });
  const burstHearts = () => {
    let n = 0;
    for (const h of hearts) {
      if (h.active) continue;
      h.active = true;
      h.t = -n * 0.08;
      h.life = 2.2 + Math.random() * 1.2;
      h.x0 = (Math.random() - 0.5) * 1.6;
      h.vx = (Math.random() - 0.5) * 0.4;
      h.sprite.position.set(h.x0, GROUND + 2.8, 0.4);
      h.sprite.visible = true;
      if (++n >= 9) break;
    }
  };

  // Camera + interaction
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let baseZ = 10;
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    baseZ = Math.max(10, 2.6 / (tanHalf * aspect));
    const dist = baseZ - BG_Z;
    const visH = 2 * dist * tanHalf;
    const visW = visH * aspect;
    const H = Math.max(visH * 1.22, (visW * 1.16) / ASPECT.bg);
    bg.scale.set(H * ASPECT.bg, H, 1);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = () => [
    couple.mesh,
    ...animals.map((a) => a.mesh),
    ...butterflies.flatMap((b) => [b.left, b.right]),
  ];
  const pick = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables(), false)[0];
    return hit?.object;
  };

  let clock = 0;
  const summon = (b: Butterfly) => {
    if (b.mode !== "wander") return;
    b.mode = "approach";
    b.modeT = 0;
    b.from.copy(b.group.position);
  };

  const onMove = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (e.pointerType === "mouse") {
      renderer.domElement.style.cursor = pick(e.clientX, e.clientY) ? "pointer" : "default";
    }
  };
  let downAt = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
    const obj = pick(e.clientX, e.clientY);
    if (!obj) return;
    if (obj === couple.mesh) burstHearts();
    const a = obj.userData["animal"] as Animal | undefined;
    if (a && clock - a.hopAt > a.hopDur) a.hopAt = clock;
    const b = obj.userData["butterfly"] as Butterfly | undefined;
    if (b) summon(b);
  };
  const el = renderer.domElement;
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);

  // Animation loop
  const introDur = reduced ? 0.01 : 4.5;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let last = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    const t = clock;

    // Camera: cinematic dolly-in then pointer parallax
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    const intro = easeInOut(clamp01(t / introDur));
    const drift = reduced ? 0 : Math.sin(t * 0.15) * 0.25;
    camera.position.set(
      pointer.x * 1.6 + drift,
      0.2 + pointer.y * 0.7 + (1 - intro) * 1.8,
      baseZ + (1 - intro) * 8,
    );
    camera.lookAt(pointer.x * 0.35, LOOK_Y + (1 - intro) * 0.6, 0);
    // The far garden keeps a fixed distance from the camera, like distant scenery.
    bg.position.z = camera.position.z - (baseZ - BG_Z);

    // Light rays shimmer
    rays.forEach((r, i) => {
      (r.material as THREE.MeshBasicMaterial).opacity =
        (r.userData["base"] as number) * (0.7 + 0.3 * Math.sin(t * 0.6 + i * 1.7));
    });

    // Couple breathing
    couple.mesh.scale.y = 1 + Math.sin(t * 1.6) * 0.004;

    // Bushes sway gently
    for (const b of bushes) b.mesh.rotation.z = Math.sin(t * 0.8 + b.phase) * 0.008;

    // Animals: idle breathing + hops
    for (const a of animals) {
      if (!reduced && a.kind !== "fawn" && clock - a.hopAt > 4 && Math.random() < dt * 0.12) a.hopAt = clock;
      const p = (clock - a.hopAt) / a.hopDur;
      const sign = a.mesh.scale.x < 0 ? -1 : 1;
      if (p >= 0 && p <= 1) {
        const up = Math.sin(Math.PI * p);
        a.holder.position.y = a.baseY + up * a.hopHeight;
        const squash = p < 0.15 || p > 0.85 ? 0.92 : 1.05;
        a.mesh.scale.set(sign * (2 - squash), squash, 1);
      } else {
        a.holder.position.y = a.baseY;
        const br = Math.sin(t * 2.2 + a.phase) * 0.012;
        a.mesh.scale.set(sign * (1 - br * 0.5), 1 + br, 1);
        a.mesh.rotation.z = a.kind === "fawn" ? Math.sin(t * 0.7 + a.phase) * 0.012 : 0;
      }
    }

    // Butterflies
    camera.getWorldDirection(fwd);
    for (const b of butterflies) {
      const bt = t * b.timeScale;
      let flapSpeed = b.flap;
      let flapAmp = 1;
      if (b.mode === "wander") {
        wanderPos(b, bt, tmp);
        wanderPos(b, bt + 0.05, tmp2);
        b.group.position.copy(tmp);
        b.face = Math.max(0, b.face - dt * 1.5);
      } else {
        b.modeT += dt;
        const target = tmp2.copy(camera.position).addScaledVector(fwd, 2.1).add(new THREE.Vector3(0, -0.15, 0));
        if (b.mode === "approach") {
          const p = easeInOut(clamp01(b.modeT / 2.4));
          b.group.position.lerpVectors(b.from, target, p);
          b.group.position.y += Math.sin(p * Math.PI) * 0.8;
          b.face = p;
          if (b.modeT >= 2.4) {
            b.mode = "hover";
            b.modeT = 0;
          }
        } else if (b.mode === "hover") {
          b.group.position.copy(target);
          b.group.position.y += Math.sin(b.modeT * 2) * 0.06;
          b.group.position.x += Math.sin(b.modeT * 1.3) * 0.05;
          flapSpeed = 5.5;
          flapAmp = 0.55;
          b.face = 1;
          if (b.modeT >= 3.8) {
            b.mode = "return";
            b.modeT = 0;
            b.from.copy(b.group.position);
          }
        } else {
          const p = easeInOut(clamp01(b.modeT / 2.6));
          wanderPos(b, bt, tmp);
          b.group.position.lerpVectors(b.from, tmp, p);
          b.face = 1 - p;
          if (b.modeT >= 2.6) b.mode = "wander";
        }
        wanderPos(b, bt, tmp);
        wanderPos(b, bt + 0.05, tmp2);
      }
      const vx = tmp2.x - tmp.x;
      const vz = tmp2.z - tmp.z;
      const wanderYaw = Math.atan2(-vx, -vz);
      b.yaw = lerpAngle(b.yaw, wanderYaw, Math.min(1, dt * 4));
      const faceYaw = Math.atan2(camera.position.x - b.group.position.x, camera.position.z - b.group.position.z);
      b.group.rotation.y = lerpAngle(b.yaw, faceYaw, b.face);
      b.tilt.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2 + 0.6, -0.15, b.face);
      b.flapPhase += dt * flapSpeed;
      const a =
        b.mode === "hover"
          ? 0.12 + 0.42 * Math.sin(b.flapPhase)
          : (0.45 + 0.75 * Math.sin(b.flapPhase)) * flapAmp;
      b.left.rotation.y = a;
      b.right.rotation.y = -a;
    }

    // Petals
    for (let i = 0; i < PETALS; i++) {
      const p = petalData[i]!;
      p.y -= p.speed * dt;
      if (p.y < -3.6) {
        p.y = 7;
        p.x = (Math.random() - 0.5) * 18;
      }
      dummy.position.set(p.x + Math.sin(t * 0.8 + p.sway) * 0.4, p.y, p.z);
      dummy.rotation.set(t * p.spin.x, t * p.spin.y, t * p.spin.z);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;

    // Dust
    for (let i = 0; i < DUST; i++) {
      const s = dustSeed[i]!;
      dustPos[i * 3] = dustBase[i * 3]! + Math.sin(t * 0.3 + s) * 0.3;
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1]! + Math.sin(t * 0.22 + s * 1.3) * 0.35;
    }
    dustGeo.attributes["position"]!.needsUpdate = true;
    dustMat.opacity = 0.65 + Math.sin(t * 1.3) * 0.15;

    // Hearts
    for (const h of hearts) {
      if (!h.active) continue;
      h.t += dt;
      if (h.t < 0) continue;
      const p = h.t / h.life;
      if (p >= 1) {
        h.active = false;
        h.sprite.visible = false;
        continue;
      }
      h.sprite.position.set(h.x0 + Math.sin(h.t * 3) * 0.15 + h.vx * h.t, GROUND + 2.8 + h.t * 0.9, 0.4);
      const s = 0.25 + Math.sin(Math.min(1, p * 4) * Math.PI * 0.5) * 0.12;
      h.sprite.scale.set(s, s, 1);
      (h.sprite.material as THREE.SpriteMaterial).opacity = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    }

    renderer.render(scene, camera);
  });

  return {
    summonButterfly: () => summon(hero.mode === "wander" ? hero : butterflies[1]!),
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        });
      });
      renderer.dispose();
      el.remove();
    },
  };
}
