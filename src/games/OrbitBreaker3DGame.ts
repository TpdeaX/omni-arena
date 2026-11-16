import * as THREE from 'three';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface Brick3D {
  mesh: THREE.Mesh;
  hp: number;
  maxHp: number;
  kind: 'normal' | 'armored' | 'gold';
  halfW: number;
  halfD: number;
}

interface Capsule3D {
  mesh: THREE.Mesh;
  kind: 'wide' | 'shield';
}

export class OrbitBreaker3DGame implements MiniGame {
  public readonly id = 'cube3d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private paddleMesh!: THREE.Mesh;
  private ballMesh!: THREE.Mesh;
  private bricks: Brick3D[] = [];
  private capsules: Capsule3D[] = [];

  private readonly arenaHalfW = 7.4;
  private readonly backZ = -18;
  private readonly paddleZ = 3.2;

  private paddleX = 0;
  private targetPaddleX = 0;
  private paddleHalfW = 1.65;
  private wideTimer = 0;

  private ballPos = new THREE.Vector3(0, 0.55, 2.2);
  private ballVel = new THREE.Vector3(4.5, 0, -13.5);
  private ballAttached = false;
  private attachTimer = 0;

  private keys = new Set<string>();
  private wave = 1;
  private bricksBroken = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;

  private paused = false;
  private destroyed = false;

  constructor(_isSlice = false) {}

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-3d';
    this.ctx.container.appendChild(this.wrapper);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080C14');
    this.scene.fog = new THREE.FogExp2('#080C14', 0.02);

    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 11.5, 11.2);
    this.camera.lookAt(0, 0, -6.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'oa-canvas-3d';
    this.wrapper.appendChild(this.renderer.domElement);

    this.buildArena();
    this.spawnBrickWave(1);
    this.resetBall(true);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.wrapper.addEventListener('pointermove', this.onPointerMove);
    this.wrapper.addEventListener('pointerdown', this.onPointerDown);

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: 'ORBIT BREAKER 3D',
      accent: '#00E5FF',
      timeLeftSec: null,
      subStat: 'OLEADA 1 · BLOQUES 0',
    });
  }

  private buildArena(): void {
    this.scene.add(new THREE.AmbientLight('#9CB6DB', 0.85));
    const dir = new THREE.DirectionalLight('#FFFFFF', 1.2);
    dir.position.set(6, 16, 10);
    this.scene.add(dir);

    const grid = new THREE.GridHelper(32, 24, '#00E5FF', '#182235');
    grid.position.set(0, 0, -7);
    this.scene.add(grid);

    // Side & back walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#192336',
      emissive: '#00E5FF',
      emissiveIntensity: 0.15,
    });
    const sideGeo = new THREE.BoxGeometry(0.35, 0.9, 24);
    for (const sx of [-this.arenaHalfW - 0.2, this.arenaHalfW + 0.2]) {
      const w = new THREE.Mesh(sideGeo, wallMat);
      w.position.set(sx, 0.45, -7);
      this.scene.add(w);
    }
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(this.arenaHalfW * 2 + 0.8, 0.9, 0.4), wallMat);
    backWall.position.set(0, 0.45, this.backZ - 0.3);
    this.scene.add(backWall);

    // Paddle
    this.paddleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.paddleHalfW * 2, 0.55, 0.75),
      new THREE.MeshStandardMaterial({
        color: '#00E5FF',
        emissive: '#00E5FF',
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.25,
      })
    );
    this.paddleMesh.position.set(0, 0.4, this.paddleZ);
    this.scene.add(this.paddleMesh);

    // Ball
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 18),
      new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        emissive: '#FFB800',
        emissiveIntensity: 0.85,
      })
    );
    this.scene.add(this.ballMesh);
  }

  private spawnBrickWave(waveNum: number): void {
    const cols = 7;
    const rows = Math.min(5, 3 + Math.floor((waveNum - 1) / 1));
    const spacingX = 1.95;
    const spacingZ = 1.45;
    const startX = -((cols - 1) * spacingX) / 2;
    const startZ = -15.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const roll = Math.random();
        const kind: Brick3D['kind'] =
          roll < 0.12 ? 'gold' : r === 0 || (waveNum > 1 && roll < 0.34) ? 'armored' : 'normal';
        const hp = kind === 'armored' ? 2 : 1;
        const color =
          kind === 'gold'
            ? '#FFB800'
            : kind === 'armored'
            ? '#7B61FF'
            : r % 2 === 0
            ? '#FF4D38'
            : '#00E5FF';

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.68, 0.65, 1.08),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            roughness: 0.3,
          })
        );
        mesh.position.set(startX + c * spacingX, 0.48, startZ + r * spacingZ);
        this.scene.add(mesh);

        this.bricks.push({
          mesh,
          hp,
          maxHp: hp,
          kind,
          halfW: 0.84,
          halfD: 0.54,
        });
      }
    }
  }

  private resetBall(autoSoon = false): void {
    this.ballAttached = true;
    this.attachTimer = autoSoon ? 0.65 : 1.1;
    this.ballPos.set(this.paddleX, 0.55, this.paddleZ - 0.85);
    const angle = (Math.random() - 0.5) * 0.7;
    const baseSpd = 14.5 * Math.sqrt(this.ctx.getIntensity());
    this.ballVel.set(Math.sin(angle) * baseSpd, 0, -Math.cos(angle) * baseSpd);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space' && this.ballAttached) {
      this.ballAttached = false;
      synthAudio.uiClick();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.paused || this.destroyed) return;
    const rect = this.wrapper.getBoundingClientRect();
    const norm = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const limit = this.arenaHalfW - this.paddleHalfW;
    this.targetPaddleX = Math.max(-limit, Math.min(limit, norm * (this.arenaHalfW + 0.6)));
  };

  private onPointerDown = (): void => {
    synthAudio.ensure();
    if (this.ballAttached) {
      this.ballAttached = false;
      synthAudio.uiClick();
    }
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (this.wideTimer > 0) {
      this.wideTimer -= dt;
      this.paddleHalfW = this.wideTimer > 0 ? 2.35 : 1.65;
    } else {
      this.paddleHalfW = 1.65;
    }
    this.paddleMesh.scale.x = this.paddleHalfW / 1.65;

    // Keyboard paddle control
    let moveDir = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveDir -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveDir += 1;
    if (moveDir !== 0) {
      const limit = this.arenaHalfW - this.paddleHalfW;
      this.targetPaddleX = Math.max(-limit, Math.min(limit, this.targetPaddleX + moveDir * 14 * dt));
    }

    this.paddleX += (this.targetPaddleX - this.paddleX) * Math.min(1, dt * 18);
    this.paddleMesh.position.x = this.paddleX;

    if (this.ballAttached) {
      this.attachTimer -= dt;
      this.ballPos.set(this.paddleX, 0.55, this.paddleZ - 0.85);
      this.ballMesh.position.copy(this.ballPos);
      if (this.attachTimer <= 0) {
        this.ballAttached = false;
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Dynamic ball speed scaled to intensity
    const intensity = this.ctx.getIntensity();
    const targetSpeed = (14.5 + (this.wave - 1) * 1.4) * (0.8 + intensity * 0.25);
    const currSpd = Math.hypot(this.ballVel.x, this.ballVel.z) || 1;
    this.ballVel.x = (this.ballVel.x / currSpd) * targetSpeed;
    this.ballVel.z = (this.ballVel.z / currSpd) * targetSpeed;

    // Sub-step physics for crisp collisions
    const steps = 2;
    const subDt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.ballPos.x += this.ballVel.x * subDt;
      this.ballPos.z += this.ballVel.z * subDt;

      // Side & back walls
      if (this.ballPos.x < -this.arenaHalfW + 0.42) {
        this.ballPos.x = -this.arenaHalfW + 0.42;
        this.ballVel.x = Math.abs(this.ballVel.x);
        synthAudio.uiClick();
      } else if (this.ballPos.x > this.arenaHalfW - 0.42) {
        this.ballPos.x = this.arenaHalfW - 0.42;
        this.ballVel.x = -Math.abs(this.ballVel.x);
        synthAudio.uiClick();
      }

      if (this.ballPos.z < this.backZ + 0.42) {
        this.ballPos.z = this.backZ + 0.42;
        this.ballVel.z = Math.abs(this.ballVel.z);
        synthAudio.uiClick();
      }

      // Paddle hit
      if (
        this.ballVel.z > 0 &&
        this.ballPos.z >= this.paddleZ - 0.72 &&
        this.ballPos.z <= this.paddleZ + 0.5 &&
        Math.abs(this.ballPos.x - this.paddleX) <= this.paddleHalfW + 0.42
      ) {
        const hitOffset = (this.ballPos.x - this.paddleX) / (this.paddleHalfW + 0.2);
        const angle = Math.max(-1.05, Math.min(1.05, hitOffset * 0.95));
        const spd = Math.hypot(this.ballVel.x, this.ballVel.z);
        this.ballVel.x = Math.sin(angle) * spd;
        this.ballVel.z = -Math.cos(angle) * spd;
        this.ballPos.z = this.paddleZ - 0.74;
        synthAudio.scheduleNoteCue(1);
      }

      // Brick collisions
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const b = this.bricks[i];
        const bx = b.mesh.position.x;
        const bz = b.mesh.position.z;
        const dx = this.ballPos.x - bx;
        const dz = this.ballPos.z - bz;
        if (Math.abs(dx) < b.halfW + 0.42 && Math.abs(dz) < b.halfD + 0.42) {
          const overlapX = b.halfW + 0.42 - Math.abs(dx);
          const overlapZ = b.halfD + 0.42 - Math.abs(dz);
          if (overlapX < overlapZ) {
            this.ballVel.x *= -1;
          } else {
            this.ballVel.z *= -1;
          }

          b.hp -= 1;
          if (b.hp <= 0) {
            this.bricksBroken += 1;
            this.combo += 1;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            const pts = b.kind === 'gold' ? 220 : b.kind === 'armored' ? 160 : 110;
            this.score += pts;
            this.ctx.addScore(pts, 1);
            synthAudio.hitmarker(this.combo);

            if (b.kind === 'gold' || Math.random() < 0.08) {
              this.spawnCapsule(bx, bz, b.kind === 'gold' && Math.random() < 0.5 ? 'shield' : 'wide');
            }

            this.scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            (b.mesh.material as THREE.Material).dispose();
            this.bricks.splice(i, 1);
          } else {
            (b.mesh.material as THREE.MeshStandardMaterial).color.set('#00E5FF');
            (b.mesh.material as THREE.MeshStandardMaterial).emissive.set('#00E5FF');
            synthAudio.uiClick();
          }
          break;
        }
      }
    }

    this.ballMesh.position.copy(this.ballPos);

    // Missed ball past paddle
    if (this.ballPos.z > this.paddleZ + 2.5) {
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.ctx.toast('ORBE PERDIDO -1 ESCUDO', 'bad');
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish({ ...this.getMetrics(), survived: false });
        return;
      }
      this.resetBall(true);
    }

    // Update falling capsules
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.mesh.position.z += 7.5 * dt;
      cap.mesh.rotation.y += dt * 3;
      if (
        Math.abs(cap.mesh.position.z - this.paddleZ) < 0.9 &&
        Math.abs(cap.mesh.position.x - this.paddleX) < this.paddleHalfW + 0.55
      ) {
        if (cap.kind === 'wide') {
          this.wideTimer = 8;
          this.ctx.toast('ESCUDO EXPANDIDO 8s', 'accent');
        } else {
          this.ctx.heal(1);
          this.ctx.toast('ESCUDO +1', 'good');
        }
        synthAudio.pickup();
        this.scene.remove(cap.mesh);
        cap.mesh.geometry.dispose();
        (cap.mesh.material as THREE.Material).dispose();
        this.capsules.splice(i, 1);
      } else if (cap.mesh.position.z > this.paddleZ + 3) {
        this.scene.remove(cap.mesh);
        cap.mesh.geometry.dispose();
        (cap.mesh.material as THREE.Material).dispose();
        this.capsules.splice(i, 1);
      }
    }

    // Next wave if cleared
    if (this.bricks.length === 0) {
      this.wave += 1;
      this.score += 350;
      this.ctx.addScore(350, 2);
      this.ctx.toast(`OLEADA ${this.wave} DESPEJADA`, 'good');
      synthAudio.puzzleSuccess(this.wave);
      this.spawnBrickWave(this.wave);
      this.resetBall(true);
    }

    this.ctx.setHud({
      subStat: `OLEADA ${this.wave} · BLOQUES ${this.bricksBroken}`,
    });

    this.renderer.render(this.scene, this.camera);
  }

  private spawnCapsule(x: number, z: number, kind: Capsule3D['kind']): void {
    const color = kind === 'shield' ? '#A6FF00' : '#FFB800';
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
    );
    mesh.position.set(x, 0.55, z);
    this.scene.add(mesh);
    this.capsules.push({ mesh, kind });
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
      Math.min(1000, Math.round(220 + this.bricksBroken * 14 + (this.wave - 1) * 110))
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.bricksBroken,
      wavesCleared: this.wave - 1,
      survived: true,
      axisPerformances: {
        reflex: perf,
        agility: Math.round(perf * 0.9),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.wrapper.removeEventListener('pointermove', this.onPointerMove);
    this.wrapper.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.dispose();
    this.wrapper.remove();
  }
}
