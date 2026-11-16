import * as THREE from 'three';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface TargetEntity {
  id: number;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  kind: 'flick' | 'drone' | 'gold';
  basePos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  spawnedAt: number;
  lifeLimit: number;
  phase: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface TracerBeam {
  line: THREE.Line;
  life: number;
}

export class Aim3DGame implements MiniGame {
  public readonly id = 'aim3d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private crosshairEl!: HTMLDivElement;
  private lockPromptEl!: HTMLDivElement;
  private hitmarkerEl!: HTMLDivElement;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private gunGroup!: THREE.Group;

  private targets: TargetEntity[] = [];
  private particles: BurstParticle[] = [];
  private tracers: TracerBeam[] = [];
  private nextId = 1;

  private yaw = 0;
  private pitch = 0;
  private pointerLocked = false;
  private recoil = 0;
  private hitmarkerTimer = 0;

  private shots = 0;
  private hits = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private reactionSamples: number[] = [];

  private elapsed = 0;
  private readonly standaloneDuration = 45;
  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  private raycaster = new THREE.Raycaster();
  private touchDragLast: { x: number; y: number; moved: boolean } | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-3d';
    this.ctx.container.appendChild(this.wrapper);

    // Three.js Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090C12');
    this.scene.fog = new THREE.FogExp2('#090C12', 0.032);

    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(68, w / h, 0.1, 120);
    this.camera.position.set(0, 1.7, 0);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'oa-canvas-3d';
    this.wrapper.appendChild(this.renderer.domElement);

    this.buildRangeEnvironment();
    this.buildWeaponViewmodel();
    this.buildOverlays();
    this.bindEvents();

    // Spawn initial 3 targets
    this.spawnTarget('flick');
    this.spawnTarget('flick');
    this.spawnTarget('drone');

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: '3D AIM LABS',
      accent: '#FF4D38',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: 'PRECISIÓN 100%',
    });
  }

  private buildRangeEnvironment(): void {
    const ambient = new THREE.AmbientLight('#8CA4C8', 0.85);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 1.15);
    keyLight.position.set(6, 14, 8);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight('#FF4D38', 2.4, 38);
    rimLight.position.set(0, 6, -14);
    this.scene.add(rimLight);

    // Floor grid
    const grid = new THREE.GridHelper(60, 36, '#FF4D38', '#1C2536');
    grid.position.y = 0;
    grid.position.z = -14;
    this.scene.add(grid);

    // Back wall architectural panels
    const wallGeo = new THREE.BoxGeometry(34, 14, 0.6);
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#111722',
      roughness: 0.75,
      metalness: 0.25,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 7, -26);
    this.scene.add(backWall);

    // Range distance pillars
    const pillarGeo = new THREE.BoxGeometry(0.9, 10, 0.9);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#1B2434',
      roughness: 0.5,
      metalness: 0.4,
    });
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(i * 6.5, 5, -18 - Math.abs(i) * 2);
      this.scene.add(p);
    }

    // Ceiling neon strips
    const stripGeo = new THREE.BoxGeometry(0.18, 0.12, 34);
    const stripMat = new THREE.MeshBasicMaterial({ color: '#FF4D38' });
    for (const x of [-6, 6]) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(x, 8.5, -12);
      this.scene.add(strip);
    }
  }

  private buildWeaponViewmodel(): void {
    this.gunGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#1E2738',
      metalness: 0.7,
      roughness: 0.3,
    });
    const accentMat = new THREE.MeshBasicMaterial({ color: '#FF4D38' });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.48), bodyMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.32), bodyMat);
    barrel.position.set(0, 0.02, -0.3);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.09), accentMat);
    sight.position.set(0, 0.075, -0.08);

    this.gunGroup.add(body, barrel, sight);
    this.gunGroup.position.set(0.32, -0.28, -0.52);
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
  }

  private buildOverlays(): void {
    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'oa-crosshair';
    this.crosshairEl.innerHTML = '<span></span>';
    this.wrapper.appendChild(this.crosshairEl);

    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.className = 'oa-hitmarker';
    this.wrapper.appendChild(this.hitmarkerEl);

    this.lockPromptEl = document.createElement('div');
    this.lockPromptEl.className = 'oa-aim-hint';
    this.lockPromptEl.innerHTML = this.ctx.isTouch
      ? '<span>TOCA UN ORBE PARA DISPARAR · ARRASTRA PARA GIRAR</span>'
      : '<span>CLIC EN ARENA PARA FIJAR MIRA FPS (O DISPARA DIRECTO)</span>';
    this.wrapper.appendChild(this.lockPromptEl);
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    dom.addEventListener('touchstart', this.onTouchStart, { passive: false });
    dom.addEventListener('touchmove', this.onTouchMove, { passive: false });
    dom.addEventListener('touchend', this.onTouchEnd);
  }

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.lockPromptEl.classList.toggle('is-hidden', this.pointerLocked);
    this.crosshairEl.classList.toggle('is-locked', this.pointerLocked);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.paused || this.destroyed) return;
    const sens = 0.0022 * this.ctx.settings.aimSensitivity;
    if (this.pointerLocked) {
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.yaw = Math.max(-0.95, Math.min(0.95, this.yaw));
      this.pitch = Math.max(-0.55, Math.min(0.55, this.pitch));
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.paused || this.destroyed || e.button !== 0) return;
    synthAudio.ensure();

    if (this.pointerLocked) {
      this.fireAtNDC(0, 0);
      return;
    }

    // Fire directly at clicked screen coordinates AND request pointer lock on desktop
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.fireAtNDC(ndcX, ndcY);

    if (!this.ctx.isTouch && this.renderer.domElement.requestPointerLock) {
      try {
        void this.renderer.domElement.requestPointerLock();
      } catch {
        // Pointer lock may be blocked in sandboxed frames; direct click works cleanly
      }
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (this.paused || this.destroyed) return;
    e.preventDefault();
    synthAudio.ensure();
    const t = e.changedTouches[0];
    this.touchDragLast = { x: t.clientX, y: t.clientY, moved: false };
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.paused || this.destroyed || !this.touchDragLast) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchDragLast.x;
    const dy = t.clientY - this.touchDragLast.y;
    if (Math.hypot(dx, dy) > 6) {
      this.touchDragLast.moved = true;
    }
    const sens = 0.0038 * this.ctx.settings.aimSensitivity;
    this.yaw = Math.max(-0.95, Math.min(0.95, this.yaw - dx * sens));
    this.pitch = Math.max(-0.55, Math.min(0.55, this.pitch - dy * sens));
    this.touchDragLast.x = t.clientX;
    this.touchDragLast.y = t.clientY;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.paused || this.destroyed) return;
    const t = e.changedTouches[0];
    if (this.touchDragLast && !this.touchDragLast.moved) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndcX = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((t.clientY - rect.top) / rect.height) * 2 + 1;
      this.fireAtNDC(ndcX, ndcY);
    }
    this.touchDragLast = null;
  };

  private fireAtNDC(ndcX: number, ndcY: number): void {
    this.shots += 1;
    this.recoil = 1;
    synthAudio.shoot();

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const meshes = this.targets.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);

    // Tracer end point
    const gunWorld = new THREE.Vector3();
    this.gunGroup.getWorldPosition(gunWorld);
    const dir = this.raycaster.ray.direction.clone();
    const endPoint = hits.length > 0 ? hits[0].point : this.raycaster.ray.origin.clone().addScaledVector(dir, 30);
    this.spawnTracer(gunWorld, endPoint);

    if (hits.length > 0) {
      const hitObj = hits[0].object as THREE.Mesh;
      const idx = this.targets.findIndex((t) => t.mesh === hitObj);
      if (idx >= 0) {
        const target = this.targets[idx];
        const rxMs = (performance.now() - target.spawnedAt);
        this.reactionSamples.push(rxMs);

        // Bullseye check (hit close to sphere center)
        const centerDist = hits[0].point.distanceTo(target.mesh.position);
        const isBullseye = centerDist < target.radius * 0.45;

        this.hits += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const speedBonus = Math.max(0, Math.round((1500 - rxMs) * 0.08));
        const basePts = target.kind === 'gold' ? 280 : target.kind === 'drone' ? 160 : 120;
        const pts = basePts + speedBonus + (isBullseye ? 50 : 0);

        this.score += pts;
        this.ctx.addScore(pts, 1);

        if (target.kind === 'gold') {
          this.ctx.heal(1);
          this.ctx.toast('NÚCLEO DORADO +1 ESCUDO', 'good');
          synthAudio.pickup();
        } else if (isBullseye) {
          synthAudio.bullseye(this.combo);
        } else {
          synthAudio.hitmarker(this.combo);
        }

        this.hitmarkerTimer = 0.14;
        this.spawnExplosion(target.mesh.position, target.kind === 'gold' ? '#FFB800' : target.kind === 'drone' ? '#00E5FF' : '#FF4D38');
        this.removeTarget(idx);

        // Respawn replacement + occasional gold orb
        const nextKind: TargetEntity['kind'] =
          Math.random() < 0.14 ? 'gold' : Math.random() < 0.4 ? 'drone' : 'flick';
        this.spawnTarget(nextKind);
      }
    } else {
      this.combo = 0;
      this.ctx.breakCombo();
    }

    const acc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
    const avgRx = this.reactionSamples.length
      ? Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length)
      : 0;
    this.ctx.setHud({
      subStat: `PREC ${acc}% · ${avgRx ? avgRx + ' ms' : '--'}`,
    });
  }

  private spawnTarget(kind: TargetEntity['kind']): void {
    const intensity = this.ctx.getIntensity();
    const z = -9 - Math.random() * 11;
    const x = (Math.random() - 0.5) * 12.5;
    const y = 1.4 + Math.random() * 4.4;

    const sizeMult = Math.max(0.72, Math.min(1.18, 1.12 - (intensity - 0.8) * 0.28));
    const radius = (kind === 'gold' ? 0.44 : kind === 'drone' ? 0.56 : 0.64) * sizeMult;
    const color = kind === 'gold' ? '#FFB800' : kind === 'drone' ? '#00E5FF' : '#FF4D38';

    const geo =
      kind === 'drone'
        ? new THREE.OctahedronGeometry(radius, 0)
        : new THREE.SphereGeometry(radius, 20, 20);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);

    const ringGeo = new THREE.RingGeometry(radius * 1.15, radius * 1.32, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(mesh.position);

    this.scene.add(mesh, ring);

    const vel =
      kind === 'drone'
        ? new THREE.Vector3(
            (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.random() * 2.2) * intensity,
            (Math.random() - 0.5) * 1.4 * intensity,
            0
          )
        : new THREE.Vector3(0, 0, 0);

    this.targets.push({
      id: this.nextId++,
      mesh,
      ring,
      kind,
      basePos: new THREE.Vector3(x, y, z),
      vel,
      radius,
      spawnedAt: performance.now(),
      lifeLimit: Math.max(2.1, (kind === 'gold' ? 3.2 : 4.6) / Math.pow(intensity, 0.7)),
      phase: Math.random() * Math.PI * 2,
    });
  }

  private removeTarget(idx: number): void {
    const t = this.targets[idx];
    this.scene.remove(t.mesh, t.ring);
    t.mesh.geometry.dispose();
    (t.mesh.material as THREE.Material).dispose();
    t.ring.geometry.dispose();
    (t.ring.material as THREE.Material).dispose();
    this.targets.splice(idx, 1);
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: '#FF8675',
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  private spawnExplosion(origin: THREE.Vector3, color: string): void {
    const geo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.2) * 8,
        (Math.random() - 0.5) * 8
      );
      this.particles.push({ mesh, vel, life: 0.38, maxLife: 0.38 });
    }
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice) {
      const rem = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: rem });
      if (rem <= 0) {
        this.ctx.finish(this.getMetrics());
        return;
      }
    }

    // Camera look & weapon recoil
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.gunGroup.position.z = -0.52 + this.recoil * 0.08;
    this.gunGroup.rotation.x = this.recoil * 0.14;

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      this.hitmarkerEl.classList.toggle('is-active', this.hitmarkerTimer > 0);
    }

    // Update targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      const age = (performance.now() - t.spawnedAt) / 1000;

      if (t.kind === 'drone') {
        t.mesh.position.addScaledVector(t.vel, dt);
        if (Math.abs(t.mesh.position.x) > 7.5) t.vel.x *= -1;
        if (t.mesh.position.y < 1.2 || t.mesh.position.y > 6.2) t.vel.y *= -1;
        t.mesh.rotation.y += dt * 3;
      } else {
        t.mesh.position.y = t.basePos.y + Math.sin(this.elapsed * 3 + t.phase) * 0.18;
      }
      t.ring.position.copy(t.mesh.position);
      t.ring.lookAt(this.camera.position);

      // Urgency pulse near expiration
      const pctLeft = Math.max(0, 1 - age / t.lifeLimit);
      const scale = 0.72 + pctLeft * 0.32;
      t.ring.scale.setScalar(1 + (1 - pctLeft) * 0.4);
      t.mesh.scale.setScalar(scale);

      if (age >= t.lifeLimit) {
        const kind = t.kind;
        this.removeTarget(i);
        if (kind !== 'gold') {
          this.combo = 0;
          this.ctx.breakCombo();
          synthAudio.damage();
          const left = this.ctx.damage(1);
          if (left <= 0) {
            this.ctx.finish({ ...this.getMetrics(), survived: false });
            return;
          }
        }
        this.spawnTarget(Math.random() < 0.4 ? 'drone' : 'flick');
      }
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.life / 0.08);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  public onResize(): void {
    if (!this.wrapper || !this.renderer) return;
    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const accuracy = this.shots > 0 ? (this.hits / this.shots) * 100 : 100;
    const avgReactionMs = this.reactionSamples.length
      ? this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length
      : 450;

    // Performance rating 100..1000
    const speedScore = Math.max(0, Math.min(450, (900 - avgReactionMs) * 0.72));
    const accScore = accuracy * 3.8;
    const volumeBonus = Math.min(200, this.hits * 6);
    const aimPerf = Math.max(150, Math.min(1000, Math.round(speedScore + accScore + volumeBonus)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      avgReactionMs,
      hits: this.hits,
      misses: Math.max(0, this.shots - this.hits),
      survived: true,
      axisPerformances: {
        aim: aimPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock();
    }
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.renderer.domElement.removeEventListener('touchend', this.onTouchEnd);

    this.renderer.dispose();
    this.wrapper.remove();
  }
}
