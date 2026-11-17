import * as THREE from 'three';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface PortalGate {
  mesh: THREE.Mesh;
  z: number;
  x: number;
  y: number;
  passed: boolean;
}

interface MeteorHazard {
  mesh: THREE.Mesh;
  z: number;
  x: number;
  y: number;
  radius: number;
}

export class FlightPortals3DGame implements MiniGame {
  public readonly id = 'flight3d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private shipGroup!: THREE.Group;
  private shipX = 0;
  private shipY = 0;
  private targetX = 0;
  private targetY = 0;

  private gates: PortalGate[] = [];
  private meteors: MeteorHazard[] = [];
  private keys = new Set<string>();
  private pointerActive = false;

  private speed = 22;
  private gateSpawnTimer = 0;
  private meteorSpawnTimer = 0.6;
  private invulnTimer = 0;

  private hits = 0;
  private misses = 0;
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
    this.scene.background = new THREE.Color('#070B14');
    this.scene.fog = new THREE.FogExp2('#070B14', 0.018);

    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.1, 140);
    this.camera.position.set(0, 1.4, 7.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'oa-canvas-3d';
    this.wrapper.appendChild(this.renderer.domElement);

    this.buildEnvironment();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.wrapper.addEventListener('pointerdown', this.onPointerDown);
    this.wrapper.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: 'VUELO DE PORTALES 3D',
      accent: '#06B6D4',
      timeLeftSec: null,
      subStat: 'PORTALES 0 · VELOCIDAD 1.0×',
    });
  }

  private buildEnvironment(): void {
    this.scene.add(new THREE.AmbientLight('#93C5FD', 0.9));
    const dir = new THREE.DirectionalLight('#FFFFFF', 1.25);
    dir.position.set(6, 12, 8);
    this.scene.add(dir);

    const floorGrid = new THREE.GridHelper(90, 36, '#06B6D4', '#152033');
    floorGrid.position.set(0, -4.4, -30);
    this.scene.add(floorGrid);

    const ceilGrid = new THREE.GridHelper(90, 36, '#0891B2', '#121A2B');
    ceilGrid.position.set(0, 4.4, -30);
    this.scene.add(ceilGrid);

    this.shipGroup = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0284C7', emissiveIntensity: 0.45 })
    );
    hull.rotation.x = -Math.PI / 2;
    this.shipGroup.add(hull);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.1, 0.55),
      new THREE.MeshStandardMaterial({ color: '#E0F2FE', emissive: '#0EA5E9', emissiveIntensity: 0.25 })
    );
    wings.position.z = 0.25;
    this.shipGroup.add(wings);

    this.shipGroup.position.set(0, 0, 1.8);
    this.scene.add(this.shipGroup);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerActive = true;
    this.updateTargetFromPointer(e);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive && e.buttons === 0 && this.ctx.isTouch) return;
    this.updateTargetFromPointer(e);
  };

  private onPointerUp = (): void => {
    this.pointerActive = false;
  };

  private updateTargetFromPointer(e: PointerEvent): void {
    const rect = this.wrapper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.targetX = Math.max(-4.5, Math.min(4.5, nx * 4.8));
    this.targetY = Math.max(-2.8, Math.min(2.8, ny * 3.1));
  }

  private spawnGate(): void {
    const x = (Math.random() - 0.5) * 7.2;
    const y = (Math.random() - 0.5) * 4.2;
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.14, 10, 28),
      new THREE.MeshStandardMaterial({ color: '#22D3EE', emissive: '#06B6D4', emissiveIntensity: 0.7 })
    );
    mesh.position.set(x, y, -64);
    this.scene.add(mesh);
    this.gates.push({ mesh, z: -64, x, y, passed: false });
  }

  private spawnMeteor(): void {
    const radius = 0.55 + Math.random() * 0.45;
    const x = (Math.random() - 0.5) * 8.6;
    const y = (Math.random() - 0.5) * 5.0;
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({ color: '#FB7185', emissive: '#E11D48', emissiveIntensity: 0.4 })
    );
    mesh.position.set(x, y, -66);
    this.scene.add(mesh);
    this.meteors.push({ mesh, z: -66, x, y, radius });
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;
    const intensity = this.ctx.getIntensity();
    const moveSpeed = this.speed * (0.85 + intensity * 0.25) + Math.min(12, this.elapsed * 0.22);

    const kSpeed = 7.5;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.targetX -= kSpeed * dt;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.targetX += kSpeed * dt;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.targetY += kSpeed * dt;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.targetY -= kSpeed * dt;

    this.targetX = Math.max(-4.5, Math.min(4.5, this.targetX));
    this.targetY = Math.max(-2.8, Math.min(2.8, this.targetY));

    const prevX = this.shipX;
    this.shipX += (this.targetX - this.shipX) * Math.min(1, dt * 10);
    this.shipY += (this.targetY - this.shipY) * Math.min(1, dt * 10);

    this.shipGroup.position.x = this.shipX;
    this.shipGroup.position.y = this.shipY;
    this.shipGroup.rotation.z = -(this.shipX - prevX) * 2.2;
    this.shipGroup.rotation.x = (this.targetY - this.shipY) * 0.25;

    this.camera.position.x += (this.shipX * 0.45 - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y += (this.shipY * 0.45 + 1.2 - this.camera.position.y) * Math.min(1, dt * 5);
    this.camera.lookAt(this.shipX * 0.5, this.shipY * 0.5, -18);

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.shipGroup.visible = Math.floor(this.invulnTimer * 18) % 2 === 0;
    } else {
      this.shipGroup.visible = true;
    }

    this.gateSpawnTimer -= dt;
    if (this.gateSpawnTimer <= 0) {
      this.spawnGate();
      this.gateSpawnTimer = Math.max(0.75, 1.45 / Math.max(0.8, intensity));
    }

    this.meteorSpawnTimer -= dt;
    if (this.meteorSpawnTimer <= 0) {
      this.spawnMeteor();
      this.meteorSpawnTimer = Math.max(0.45, 1.05 / Math.max(0.8, intensity));
    }

    // Update gates
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.z += moveSpeed * dt;
      g.mesh.position.z = g.z;
      g.mesh.rotation.z += dt * 1.4;

      if (!g.passed && g.z >= 1.2 && g.z <= 2.4) {
        const dist = Math.hypot(g.x - this.shipX, g.y - this.shipY);
        if (dist <= 1.48) {
          g.passed = true;
          this.hits += 1;
          this.combo += 1;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.score += 140;
          this.ctx.addScore(140, 1);
          synthAudio.pickup();
          this.scene.remove(g.mesh);
          this.gates.splice(i, 1);
          continue;
        }
      }

      if (g.z > 5.5) {
        if (!g.passed) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
        }
        this.scene.remove(g.mesh);
        this.gates.splice(i, 1);
      }
    }

    // Update meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.z += moveSpeed * 1.08 * dt;
      m.mesh.position.z = m.z;
      m.mesh.rotation.x += dt * 1.8;
      m.mesh.rotation.y += dt * 1.3;

      if (this.invulnTimer <= 0 && m.z >= 1.1 && m.z <= 2.5) {
        const dist = Math.hypot(m.x - this.shipX, m.y - this.shipY);
        if (dist <= m.radius + 0.55) {
          this.invulnTimer = 1.1;
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          synthAudio.damage();
          const left = this.ctx.damage(1);
          this.scene.remove(m.mesh);
          this.meteors.splice(i, 1);
          if (left <= 0) {
            this.ctx.finish(this.getMetrics(false));
            return;
          }
          continue;
        }
      }

      if (m.z > 6) {
        this.scene.remove(m.mesh);
        this.meteors.splice(i, 1);
      }
    }

    this.ctx.setHud({
      subStat: `PORTALES ${this.hits} · FALLOS ${this.misses}`,
    });

    this.renderer.render(this.scene, this.camera);
  }

  public onResize(): void {
    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(survived = true): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const accuracy = total > 0 ? (this.hits / total) * 100 : 100;
    const agilityScore = Math.min(980, 260 + this.hits * 32 + this.maxCombo * 18 - this.misses * 25);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      hits: this.hits,
      misses: this.misses,
      survived,
      axisPerformances: {
        agility: Math.max(120, agilityScore),
        aim: Math.max(120, Math.round(agilityScore * 0.92)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.wrapper.removeEventListener('pointerdown', this.onPointerDown);
    this.wrapper.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.dispose();
    this.wrapper.remove();
  }
}
