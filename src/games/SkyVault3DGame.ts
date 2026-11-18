import * as THREE from 'three';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface Platform3D {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  kind: 'solid' | 'moving' | 'fragile' | 'boost';
  baseX: number;
  moveAmp: number;
  moveSpd: number;
  phase: number;
  crumbleTimer: number; // >0 once stepped on
  gone: boolean;
}

interface Gem3D {
  mesh: THREE.Mesh;
  taken: boolean;
}

export class SkyVault3DGame implements MiniGame {
  public readonly id = 'parkour3d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private touchUiEl: HTMLDivElement | null = null;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private playerMesh!: THREE.Mesh;
  private shadowRing!: THREE.Mesh;
  private platforms: Platform3D[] = [];
  private gems: Gem3D[] = [];

  private px = 0;
  private py = 1.6;
  private pz = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;

  private grounded = false;
  private jumpsLeft = 2;
  private coyoteTimer = 0;
  private safePos = new THREE.Vector3(0, 2.2, 0);

  private keys = new Set<string>();
  private touchMove = { x: 0, z: 0 };
  private furthestZ = 0;
  private generatedUntilZ = 0;
  private gemsTaken = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private paused = false;
  private destroyed = false;

  constructor(_isSlice = false) {}

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-3d';
    this.ctx.container.appendChild(this.wrapper);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090D16');
    this.scene.fog = new THREE.FogExp2('#090D16', 0.018);

    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(68, w / h, 0.1, 140);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'oa-canvas-3d';
    this.wrapper.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight('#9CB6DC', 0.85));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.2);
    sun.position.set(8, 18, 12);
    this.scene.add(sun);

    this.buildPlayer();
    this.createPlatform(0, 0, 0, 5.2, 5.6, 'solid');
    this.generatedUntilZ = -3;
    this.ensureCourseAhead();

    if (this.ctx.isTouch) {
      this.buildTouchControls();
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: 'SALTO CELESTE 3D',
      accent: '#A6FF00',
      timeLeftSec: null,
      subStat: 'DIST 0m · GEMAS 0',
    });
  }

  private buildPlayer(): void {
    this.playerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.9, 0.76),
      new THREE.MeshStandardMaterial({
        color: '#A6FF00',
        emissive: '#A6FF00',
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    this.playerMesh.position.set(this.px, this.py, this.pz);
    this.scene.add(this.playerMesh);

    // Drop-shadow guide ring so depth perception on jumps is crystal clear
    this.shadowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.48, 20),
      new THREE.MeshBasicMaterial({ color: '#00E5FF', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    this.shadowRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadowRing);
  }

  private buildTouchControls(): void {
    this.touchUiEl = document.createElement('div');
    this.touchUiEl.className = 'oa-touch-parkour';
    this.touchUiEl.innerHTML = `
      <div class="oa-touch-dpad">
        <button type="button" data-dir="up" aria-label="Adelante">${Icons.arrowUp(18)}</button>
        <div class="oa-touch-dpad-mid">
          <button type="button" data-dir="left" aria-label="Izquierda">${Icons.arrowLeft(18)}</button>
          <button type="button" data-dir="down" aria-label="Atrás">${Icons.arrowDown(18)}</button>
          <button type="button" data-dir="right" aria-label="Derecha">${Icons.arrowRight(18)}</button>
        </div>
      </div>
      <button type="button" class="oa-touch-jump-big" data-act="jump">SALTAR x2</button>
    `;

    const setDir = (dir: string, active: boolean) => {
      if (dir === 'up') this.touchMove.z = active ? -1 : 0;
      if (dir === 'down') this.touchMove.z = active ? 1 : 0;
      if (dir === 'left') this.touchMove.x = active ? -1 : 0;
      if (dir === 'right') this.touchMove.x = active ? 1 : 0;
    };

    this.touchUiEl.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir!;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        synthAudio.ensure();
        setDir(dir, true);
      });
      btn.addEventListener('pointerup', () => setDir(dir, false));
      btn.addEventListener('pointerleave', () => setDir(dir, false));
    });

    this.touchUiEl.querySelector('[data-act="jump"]')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      synthAudio.ensure();
      this.tryJump();
    });

    this.wrapper.appendChild(this.touchUiEl);
  }

  private createPlatform(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    kind: Platform3D['kind']
  ): void {
    const color =
      kind === 'moving'
        ? '#7B61FF'
        : kind === 'fragile'
        ? '#FFB800'
        : kind === 'boost'
        ? '#00E5FF'
        : '#1E293E';
    const emissive = kind === 'solid' ? '#2B3B59' : color;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.55, d),
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: kind === 'solid' ? 0.2 : 0.45,
        roughness: 0.35,
      })
    );
    mesh.position.set(x, y - 0.275, z);
    this.scene.add(mesh);

    this.platforms.push({
      mesh,
      x,
      y,
      z,
      w,
      d,
      kind,
      baseX: x,
      moveAmp: kind === 'moving' ? 2.4 : 0,
      moveSpd: 1.6 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      crumbleTimer: 0,
      gone: false,
    });
  }

  private ensureCourseAhead(): void {
    const intensity = this.ctx.getIntensity();
    while (this.generatedUntilZ > this.pz - 65) {
      const prev = this.platforms[this.platforms.length - 1];
      const gap = 3.6 + Math.random() * (1.8 + intensity * 0.7);
      const nextZ = prev.z - prev.d / 2 - gap;
      const nextX = Math.max(-5.5, Math.min(5.5, prev.x + (Math.random() - 0.5) * 4.6));
      const nextY = Math.max(-1.5, Math.min(4.2, prev.y + (Math.random() - 0.45) * 1.4));

      const roll = Math.random();
      const kind: Platform3D['kind'] =
        roll < 0.24 ? 'moving' : roll < 0.42 ? 'fragile' : roll < 0.54 ? 'boost' : 'solid';
      const w = Math.max(2.1, (kind === 'solid' ? 3.2 : 2.7) - (intensity - 1) * 0.35);
      const d = kind === 'boost' ? 2.8 : 3.2 + Math.random() * 1.2;

      this.createPlatform(nextX, nextY, nextZ - d / 2, w, d, kind);
      this.generatedUntilZ = nextZ - d;

      if (Math.random() < 0.7) {
        const gemMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({
            color: '#00E5FF',
            emissive: '#00E5FF',
            emissiveIntensity: 0.75,
          })
        );
        gemMesh.position.set(nextX, nextY + 1.15, nextZ - d / 2);
        this.scene.add(gemMesh);
        this.gems.push({ mesh: gemMesh, taken: false });
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.tryJump();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private tryJump(): void {
    if (this.paused || this.destroyed) return;
    if (this.grounded || this.coyoteTimer > 0) {
      this.vy = 11.4;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpsLeft = 1;
      synthAudio.jump();
    } else if (this.jumpsLeft > 0) {
      this.vy = 10.6;
      this.jumpsLeft = 0;
      synthAudio.scheduleNoteCue(3);
    }
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;

    const intensity = this.ctx.getIntensity();

    // Update moving & crumbling platforms
    for (const p of this.platforms) {
      if (p.gone) continue;
      if (p.kind === 'moving') {
        const prevX = p.x;
        p.x = p.baseX + Math.sin(performance.now() * 0.001 * p.moveSpd * intensity + p.phase) * p.moveAmp;
        p.mesh.position.x = p.x;
        if (this.grounded && Math.abs(this.pz - p.z) <= p.d / 2 + 0.38 && Math.abs(this.py - 0.45 - p.y) < 0.25) {
          this.px += p.x - prevX;
        }
      }
      if (p.crumbleTimer > 0) {
        p.crumbleTimer -= dt;
        p.mesh.position.y = p.y - 0.275 + (Math.random() - 0.5) * 0.08;
        if (p.crumbleTimer <= 0) {
          p.gone = true;
          p.mesh.visible = false;
        }
      }
    }

    // Horizontal input
    let ix = this.touchMove.x;
    let iz = this.touchMove.z;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
    if (ix !== 0 && iz !== 0) {
      const len = Math.hypot(ix, iz);
      ix /= len;
      iz /= len;
    }

    const moveSpeed = 9.2 * (0.9 + intensity * 0.14);
    this.vx = ix * moveSpeed;
    this.vz = iz * moveSpeed;

    const prevBottom = this.py - 0.45;
    this.px += this.vx * dt;
    this.pz += this.vz * dt;
    this.vy -= 28 * dt;
    this.py += this.vy * dt;

    // Platform landing collision
    let onGround = false;
    let dropShadowY: number | null = null;
    const newBottom = this.py - 0.45;

    for (const p of this.platforms) {
      if (p.gone) continue;
      const inXZ =
        Math.abs(this.px - p.x) <= p.w / 2 + 0.34 &&
        Math.abs(this.pz - p.z) <= p.d / 2 + 0.34;
      if (inXZ && p.y <= this.py) {
        if (dropShadowY === null || p.y > dropShadowY) dropShadowY = p.y;
      }
      if (inXZ && this.vy <= 0 && prevBottom >= p.y - 0.35 && newBottom <= p.y + 0.15) {
        this.py = p.y + 0.45;
        this.vy = 0;
        onGround = true;
        this.jumpsLeft = 2;

        if (p.kind === 'solid' || p.kind === 'moving') {
          this.safePos.set(p.x, p.y + 1.2, p.z);
        }
        if (p.kind === 'fragile' && p.crumbleTimer === 0) {
          p.crumbleTimer = 0.65;
        }
        if (p.kind === 'boost') {
          this.vy = 16.5;
          onGround = false;
          this.jumpsLeft = 1;
          synthAudio.pickup();
          this.ctx.toast('IMPULSO +80', 'accent');
          this.score += 80;
          this.ctx.addScore(80, 1);
        }
        break;
      }
    }

    if (onGround) {
      this.grounded = true;
      this.coyoteTimer = 0.13;
    } else {
      this.grounded = false;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Distance score
    if (-this.pz > this.furthestZ) {
      const gained = -this.pz - this.furthestZ;
      this.furthestZ = -this.pz;
      const pts = Math.round(gained * 18);
      if (pts > 0) {
        this.score += pts;
        this.ctx.addScore(pts, 0);
      }
    }

    // Gems
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gm = this.gems[i];
      if (gm.taken) continue;
      gm.mesh.rotation.y += dt * 3.5;
      if (
        Math.hypot(gm.mesh.position.x - this.px, gm.mesh.position.z - this.pz) < 1.15 &&
        Math.abs(gm.mesh.position.y - this.py) < 1.35
      ) {
        gm.taken = true;
        gm.mesh.visible = false;
        this.gemsTaken += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 140;
        this.ctx.addScore(140, 1);
        synthAudio.pickup();
      }
    }

    // Fall into void
    if (this.py < -6.5) {
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.ctx.toast('CAÍDA AL VACÍO -1 ESCUDO', 'bad');
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish({ ...this.getMetrics(), survived: false });
        return;
      }
      this.px = this.safePos.x;
      this.py = this.safePos.y + 1.5;
      this.pz = this.safePos.z;
      this.vy = 0;
    }

    this.ensureCourseAhead();

    // Update meshes & smooth chase camera
    this.playerMesh.position.set(this.px, this.py, this.pz);
    this.playerMesh.rotation.y += dt * (this.grounded ? 1.5 : 4.5);

    if (dropShadowY !== null) {
      this.shadowRing.visible = true;
      this.shadowRing.position.set(this.px, dropShadowY + 0.04, this.pz);
    } else {
      this.shadowRing.visible = false;
    }

    const desiredCamX = this.px * 0.65;
    const desiredCamY = this.py + 4.4;
    const desiredCamZ = this.pz + 8.6;
    this.camera.position.x += (desiredCamX - this.camera.position.x) * Math.min(1, dt * 8);
    this.camera.position.y += (desiredCamY - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (desiredCamZ - this.camera.position.z) * Math.min(1, dt * 10);
    this.camera.lookAt(this.px * 0.85, this.py + 0.4, this.pz - 5.5);

    this.ctx.setHud({
      subStat: `DIST ${Math.round(this.furthestZ)}m · GEMAS ${this.gemsTaken}`,
    });

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
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const perf = Math.max(
      180,
      Math.min(1000, Math.round(220 + this.furthestZ * 3.8 + this.gemsTaken * 26))
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.gemsTaken,
      survived: true,
      axisPerformances: {
        agility: perf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.dispose();
    this.wrapper.remove();
  }
}
