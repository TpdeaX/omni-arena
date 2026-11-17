import * as THREE from 'three';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface TunnelObject {
  mesh: THREE.Mesh;
  lane: number; // 0, 1, 2
  kind: 'pillar' | 'hurdle' | 'core';
  z: number;
  resolved: boolean;
}

const LANES_X = [-2.5, 0, 2.5];

export class Runner3DGame implements MiniGame {
  public readonly id = 'runner3d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private touchControlsEl: HTMLDivElement | null = null;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private playerMesh!: THREE.Mesh;
  private gridFloor!: THREE.GridHelper;
  private objects: TunnelObject[] = [];

  private currentLane = 1;
  private targetX = 0;
  private playerY = 0.55;
  private velY = 0;
  private grounded = true;
  private invulnTimer = 0;

  private speed = 22;
  private spawnTimer = 0.6;
  private distance = 0;
  private coresCollected = 0;
  private nearMisses = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;

  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;
  private swipeStart: { x: number; y: number } | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-3d';
    this.ctx.container.appendChild(this.wrapper);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090B14');
    this.scene.fog = new THREE.FogExp2('#090B14', 0.022);

    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.1, 140);
    this.camera.position.set(0, 3.2, 6.2);
    this.camera.lookAt(0, 1.1, -12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'oa-canvas-3d';
    this.wrapper.appendChild(this.renderer.domElement);

    this.buildTunnel();
    this.buildPlayer();
    if (this.ctx.isTouch) {
      this.buildTouchPad();
    }
    this.bindEvents();

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: 'TÚNEL HIPER 3D',
      accent: '#7B61FF',
      timeLeftSec: null,
      subStat: 'VEL 22 m/s · 0m',
    });
  }

  private buildTunnel(): void {
    this.scene.add(new THREE.AmbientLight('#9CB0D9', 0.8));
    const dir = new THREE.DirectionalLight('#FFFFFF', 1.1);
    dir.position.set(4, 12, 6);
    this.scene.add(dir);

    this.gridFloor = new THREE.GridHelper(110, 44, '#7B61FF', '#1C2238');
    this.gridFloor.position.set(0, 0, -40);
    this.scene.add(this.gridFloor);

    // Side rails marking the 3 lanes
    const railGeo = new THREE.BoxGeometry(0.1, 0.1, 100);
    const railMat = new THREE.MeshBasicMaterial({ color: '#7B61FF' });
    for (const x of [-4.0, -1.25, 1.25, 4.0]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(x, 0.03, -40);
      this.scene.add(rail);
    }

    // Tunnel ceiling arches
    const archGeo = new THREE.TorusGeometry(6.5, 0.08, 6, 20, Math.PI);
    const archMat = new THREE.MeshBasicMaterial({ color: '#273154' });
    for (let z = -5; z >= -85; z -= 10) {
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(0, 0, z);
      this.scene.add(arch);
    }
  }

  private buildPlayer(): void {
    const geo = new THREE.ConeGeometry(0.55, 1.35, 4);
    geo.rotateX(-Math.PI / 2);
    geo.rotateZ(Math.PI / 4);
    const mat = new THREE.MeshStandardMaterial({
      color: '#00E5FF',
      emissive: '#7B61FF',
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.25,
    });
    this.playerMesh = new THREE.Mesh(geo, mat);
    this.playerMesh.position.set(0, this.playerY, 0);
    this.scene.add(this.playerMesh);
  }

  private buildTouchPad(): void {
    this.touchControlsEl = document.createElement('div');
    this.touchControlsEl.className = 'oa-touch-runner';
    this.touchControlsEl.innerHTML = `
      <button type="button" data-act="left">IZQ</button>
      <button type="button" data-act="jump">SALTAR</button>
      <button type="button" data-act="right">DER</button>
    `;
    this.touchControlsEl.addEventListener('pointerdown', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      e.preventDefault();
      synthAudio.ensure();
      const act = btn.dataset.act;
      if (act === 'left') this.shiftLane(-1);
      if (act === 'right') this.shiftLane(1);
      if (act === 'jump') this.jump();
    });
    this.wrapper.appendChild(this.touchControlsEl);
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    this.wrapper.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.wrapper.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      this.shiftLane(-1);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      this.shiftLane(1);
    } else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.jump();
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return;
    const t = e.changedTouches[0];
    this.swipeStart = { x: t.clientX, y: t.clientY };
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.swipeStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.swipeStart.x;
    const dy = t.clientY - this.swipeStart.y;
    this.swipeStart = null;

    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      this.shiftLane(dx > 0 ? 1 : -1);
    } else if (dy < -28) {
      this.jump();
    }
  };

  private shiftLane(dir: -1 | 1): void {
    const next = Math.max(0, Math.min(2, this.currentLane + dir));
    if (next !== this.currentLane) {
      this.currentLane = next;
      this.targetX = LANES_X[this.currentLane];
      synthAudio.uiClick();
    }
  }

  private jump(): void {
    if (this.grounded) {
      this.velY = 12.2;
      this.grounded = false;
      synthAudio.jump();
    }
  }

  private spawnWave(): void {
    const zStart = -88;
    const pattern = Math.random();

    if (pattern < 0.34) {
      // Low laser hurdle across 2 or 3 lanes -> must jump or dodge
      const openLane = Math.random() < 0.4 ? -1 : Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane++) {
        if (lane === openLane) continue;
        this.createObj(lane, 'hurdle', zStart);
      }
      if (openLane >= 0) {
        this.createObj(openLane, 'core', zStart - 2);
      }
    } else if (pattern < 0.72) {
      // 1 or 2 tall pillars -> switch lanes
      const freeLane = Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane++) {
        if (lane === freeLane) {
          if (Math.random() < 0.75) this.createObj(lane, 'core', zStart);
        } else if (Math.random() < 0.75) {
          this.createObj(lane, 'pillar', zStart);
        }
      }
    } else {
      // Staggered slalom + core
      const laneA = Math.floor(Math.random() * 3);
      const laneB = (laneA + 1) % 3;
      this.createObj(laneA, 'pillar', zStart);
      this.createObj(laneB, 'core', zStart - 6);
    }
  }

  private createObj(lane: number, kind: TunnelObject['kind'], z: number): void {
    let geo: THREE.BufferGeometry;
    let color: string;
    let y: number;

    if (kind === 'pillar') {
      geo = new THREE.BoxGeometry(1.65, 3.0, 1.3);
      color = '#FF4D38';
      y = 1.5;
    } else if (kind === 'hurdle') {
      geo = new THREE.BoxGeometry(2.1, 0.85, 0.65);
      color = '#FFB800';
      y = 0.45;
    } else {
      geo = new THREE.OctahedronGeometry(0.48, 0);
      color = '#00E5FF';
      y = 0.9;
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: kind === 'core' ? 0.8 : 0.45,
      roughness: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LANES_X[lane], y, z);
    this.scene.add(mesh);

    this.objects.push({ mesh, lane, kind, z, resolved: false });
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    // Speed ramp + Dynamic Intensity scaling
    const intensity = this.ctx.getIntensity();
    const speedBoost =
      (this.isGauntletSlice ? 25 + this.elapsed * 0.55 : 22 + Math.min(24, this.elapsed * 0.45)) *
      (0.84 + intensity * 0.24);
    this.speed = speedBoost;
    this.distance += this.speed * dt;
    const distPts = Math.round(this.speed * dt * 1.4);
    this.score += distPts;
    this.ctx.addScore(distPts, 0);

    // Move grid floor loop for speed illusion
    this.gridFloor.position.z = -40 + ((this.distance * 1) % 2.5);
    this.camera.fov = 72 + (this.speed - 22) * 0.35;
    this.camera.updateProjectionMatrix();

    // Player horizontal & vertical physics
    const dx = this.targetX - this.playerMesh.position.x;
    this.playerMesh.position.x += dx * Math.min(1, dt * 14);
    this.playerMesh.rotation.z = -dx * 0.22;

    if (!this.grounded) {
      this.velY -= 32 * dt;
      this.playerY += this.velY * dt;
      if (this.playerY <= 0.55) {
        this.playerY = 0.55;
        this.velY = 0;
        this.grounded = true;
      }
    }
    this.playerMesh.position.y = this.playerY;

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.playerMesh.visible = Math.floor(this.invulnTimer * 18) % 2 === 0;
    } else {
      this.playerMesh.visible = true;
    }

    // Spawn objects
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave();
      this.spawnTimer = Math.max(0.42, 0.92 - (this.speed - 22) * 0.015);
    }

    // Update objects & check collision
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.z += this.speed * dt;
      obj.mesh.position.z = obj.z;
      if (obj.kind === 'core') {
        obj.mesh.rotation.y += dt * 3.5;
      }

      if (!obj.resolved && obj.z > -0.9 && obj.z < 0.9) {
        const xDist = Math.abs(obj.mesh.position.x - this.playerMesh.position.x);
        if (obj.kind === 'core' && xDist < 1.15 && this.playerY < 2.2) {
          obj.resolved = true;
          this.coresCollected += 1;
          this.combo += 1;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.score += 120;
          this.ctx.addScore(120, 1);
          synthAudio.pickup();
          this.removeObj(i);
          continue;
        }

        if (obj.kind !== 'core' && xDist < 1.0) {
          const hitHeight = obj.kind === 'hurdle' ? 1.05 : 2.9;
          if (this.playerY < hitHeight) {
            obj.resolved = true;
            if (this.invulnTimer <= 0) {
              this.invulnTimer = 1.1;
              this.combo = 0;
              this.ctx.breakCombo();
              synthAudio.damage();
              this.ctx.toast('IMPACTO EN TÚNEL', 'bad');
              const left = this.ctx.damage(1);
              if (left <= 0) {
                this.ctx.finish({ ...this.getMetrics(), survived: false });
                return;
              }
            }
          } else if (obj.kind === 'hurdle') {
            obj.resolved = true;
            this.nearMisses += 1;
            this.score += 65;
            this.ctx.addScore(65, 1);
            this.ctx.toast('SALTO LIMPIO +65', 'accent');
          }
        }
      }

      if (obj.z > 8) {
        if (!obj.resolved && obj.kind !== 'core') {
          this.nearMisses += 1;
        }
        this.removeObj(i);
      }
    }

    this.ctx.setHud({
      subStat: `VEL ${Math.round(this.speed)} m/s · ${Math.round(this.distance)}m`,
    });

    this.renderer.render(this.scene, this.camera);
  }

  private removeObj(idx: number): void {
    const o = this.objects[idx];
    this.scene.remove(o.mesh);
    o.mesh.geometry.dispose();
    (o.mesh.material as THREE.Material).dispose();
    this.objects.splice(idx, 1);
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
    const agilityPerf = Math.max(
      180,
      Math.min(1000, Math.round(240 + this.distance * 0.45 + this.coresCollected * 22))
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.coresCollected,
      grazes: this.nearMisses,
      survived: true,
      axisPerformances: {
        agility: agilityPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.removeEventListener('touchstart', this.onTouchStart);
    this.wrapper.removeEventListener('touchend', this.onTouchEnd);
    this.renderer.dispose();
    this.wrapper.remove();
  }
}
