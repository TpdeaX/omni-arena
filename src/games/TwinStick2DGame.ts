import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface PlayerBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: 'chaser' | 'splitter' | 'mini' | 'charger';
  color: string;
  chargeState: number; // for charger telegraph
  chargeTimer: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: 'spread' | 'shield';
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class TwinStick2DGame implements MiniGame {
  public readonly id = 'twinstick2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private dashBtnEl: HTMLButtonElement | null = null;

  private width = 800;
  private height = 520;
  private dpr = 1;

  private px = 400;
  private py = 260;
  private aimX = 500;
  private aimY = 260;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashVx = 0;
  private dashVy = 0;
  private invuln = 0;
  private spreadTimer = 0;
  private fireCooldown = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private touchMoveId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchVec = { x: 0, y: 0 };

  private bullets: PlayerBullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];

  private spawnTimer = 0.6;
  private kills = 0;
  private shots = 0;
  private hits = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;

  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-2d';
    this.ctx.container.appendChild(this.wrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'oa-canvas-2d';
    this.wrapper.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d')!;

    this.onResize();
    this.px = this.width / 2;
    this.py = this.height / 2;

    if (this.ctx.isTouch) {
      this.dashBtnEl = document.createElement('button');
      this.dashBtnEl.type = 'button';
      this.dashBtnEl.className = 'oa-touch-dash';
      this.dashBtnEl.textContent = 'IMPULSO';
      this.dashBtnEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.triggerDash();
      });
      this.wrapper.appendChild(this.dashBtnEl);
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'ARENA DOBLE MANDO',
      accent: '#EA580C',
      timeLeftSec: null,
      subStat: 'BAJAS 0 · ESPACIO IMPULSO',
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if ((e.code === 'Space' || e.code === 'ShiftLeft') && !e.repeat) {
      e.preventDefault();
      this.triggerDash();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.aimX = e.clientX - rect.left;
    this.aimY = e.clientY - rect.top;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    synthAudio.ensure();
    this.mouseDown = true;
  };

  private onMouseUp = (): void => {
    this.mouseDown = false;
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    synthAudio.ensure();
    const t = e.changedTouches[0];
    if (this.touchMoveId === null) {
      this.touchMoveId = t.identifier;
      this.touchOrigin = { x: t.clientX, y: t.clientY };
      this.touchVec = { x: 0, y: 0 };
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.touchMoveId) {
        const dx = t.clientX - this.touchOrigin.x;
        const dy = t.clientY - this.touchOrigin.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4) {
          const mag = Math.min(1, dist / 40);
          this.touchVec = { x: (dx / dist) * mag, y: (dy / dist) * mag };
        }
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.touchMoveId) {
        this.touchMoveId = null;
        this.touchVec = { x: 0, y: 0 };
      }
    }
  };

  private triggerDash(): void {
    if (this.paused || this.destroyed || this.dashCooldown > 0) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (this.touchMoveId !== null && (this.touchVec.x || this.touchVec.y)) {
      dx = this.touchVec.x;
      dy = this.touchVec.y;
    }
    if (dx === 0 && dy === 0) {
      const ang = Math.atan2(this.aimY - this.py, this.aimX - this.px);
      dx = Math.cos(ang);
      dy = Math.sin(ang);
    } else {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }

    this.dashVx = dx * 720;
    this.dashVy = dy * 720;
    this.dashTimer = 0.16;
    this.invuln = Math.max(this.invuln, 0.24);
    this.dashCooldown = 1.1;
    synthAudio.dash();
    this.spawnParticles(this.px, this.py, '#00E5FF', 8);
  }

  private spawnEnemy(): void {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * this.width;
      y = -24;
    } else if (edge === 1) {
      x = this.width + 24;
      y = Math.random() * this.height;
    } else if (edge === 2) {
      x = Math.random() * this.width;
      y = this.height + 24;
    } else {
      x = -24;
      y = Math.random() * this.height;
    }

    const r = Math.random();
    const kind: Enemy['kind'] =
      r < 0.22 && this.elapsed > 5 ? 'splitter' : r < 0.44 && this.elapsed > 3 ? 'charger' : 'chaser';

    this.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      r: kind === 'splitter' ? 18 : kind === 'charger' ? 14 : 12,
      hp: kind === 'splitter' ? 3 : kind === 'charger' ? 2 : 1,
      maxHp: kind === 'splitter' ? 3 : kind === 'charger' ? 2 : 1,
      kind,
      color: kind === 'splitter' ? '#7B61FF' : kind === 'charger' ? '#FFB800' : '#FF4D38',
      chargeState: 0,
      chargeTimer: 1.5 + Math.random(),
    });
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.spreadTimer > 0) this.spreadTimer -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Movement
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.px += this.dashVx * dt;
      this.py += this.dashVy * dt;
    } else {
      let mx = 0;
      let my = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
      if (mx !== 0 && my !== 0) {
        mx *= Math.SQRT1_2;
        my *= Math.SQRT1_2;
      }
      if (this.touchMoveId !== null) {
        mx = this.touchVec.x;
        my = this.touchVec.y;
      }
      this.px += mx * 285 * dt;
      this.py += my * 285 * dt;
    }
    this.px = Math.max(18, Math.min(this.width - 18, this.px));
    this.py = Math.max(18, Math.min(this.height - 18, this.py));

    // On touch devices, auto-aim closest enemy and auto-fire!
    let shouldFire = this.mouseDown;
    if (this.ctx.isTouch && this.enemies.length > 0) {
      let nearest = this.enemies[0];
      let bestD = Infinity;
      for (const en of this.enemies) {
        const d = Math.hypot(en.x - this.px, en.y - this.py);
        if (d < bestD) {
          bestD = d;
          nearest = en;
        }
      }
      this.aimX = nearest.x;
      this.aimY = nearest.y;
      shouldFire = true;
    }

    // Fire
    if (shouldFire && this.fireCooldown <= 0) {
      const ang = Math.atan2(this.aimY - this.py, this.aimX - this.px);
      const angles = this.spreadTimer > 0 ? [ang - 0.16, ang, ang + 0.16] : [ang];
      for (const a of angles) {
        this.bullets.push({
          x: this.px + Math.cos(a) * 16,
          y: this.py + Math.sin(a) * 16,
          vx: Math.cos(a) * 660,
          vy: Math.sin(a) * 660,
          life: 1.4,
        });
      }
      this.shots += 1;
      this.fireCooldown = this.spreadTimer > 0 ? 0.13 : 0.16;
      synthAudio.shoot();
    }

    // Spawn enemies
    const intensity = this.ctx.getIntensity();
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      const pace = Math.max(
        0.26,
        (1.05 - this.elapsed * 0.018 - (this.isGauntletSlice ? 0.15 : 0)) / Math.sqrt(intensity)
      );
      this.spawnTimer = pace;
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) {
        this.bullets.splice(i, 1);
        continue;
      }

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const en = this.enemies[j];
        if (Math.hypot(b.x - en.x, b.y - en.y) < en.r + 5) {
          this.bullets.splice(i, 1);
          en.hp -= 1;
          this.hits += 1;
          this.spawnParticles(b.x, b.y, en.color, 4);
          if (en.hp <= 0) {
            this.killEnemy(j);
          } else {
            synthAudio.hitmarker(this.combo);
          }
          break;
        }
      }
    }

    // Update enemies
    const diffMult = (1 + Math.min(0.75, this.elapsed * 0.015)) * (0.85 + intensity * 0.22);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      const ang = Math.atan2(this.py - en.y, this.px - en.x);

      if (en.kind === 'charger') {
        en.chargeTimer -= dt;
        if (en.chargeState === 0) {
          en.x += Math.cos(ang) * 95 * diffMult * dt;
          en.y += Math.sin(ang) * 95 * diffMult * dt;
          if (en.chargeTimer <= 0) {
            en.chargeState = 1;
            en.chargeTimer = 0.45;
            en.vx = Math.cos(ang) * 440;
            en.vy = Math.sin(ang) * 440;
          }
        } else if (en.chargeState === 1) {
          // Telegraph pause
          if (en.chargeTimer <= 0) {
            en.chargeState = 2;
            en.chargeTimer = 0.42;
          }
        } else {
          en.x += en.vx * dt;
          en.y += en.vy * dt;
          if (en.chargeTimer <= 0) {
            en.chargeState = 0;
            en.chargeTimer = 1.6;
          }
        }
      } else {
        const spd = (en.kind === 'mini' ? 190 : en.kind === 'splitter' ? 95 : 145) * diffMult;
        en.x += Math.cos(ang) * spd * dt;
        en.y += Math.sin(ang) * spd * dt;
      }

      if (this.invuln <= 0 && Math.hypot(en.x - this.px, en.y - this.py) < en.r + 12) {
        this.enemies.splice(i, 1);
        this.invuln = 1.1;
        this.combo = 0;
        this.ctx.breakCombo();
        synthAudio.damage();
        this.spawnParticles(this.px, this.py, '#FF4D38', 14);
        this.ctx.toast('GOLPE EN ARENA -1 ESCUDO', 'bad');
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish({ ...this.getMetrics(), survived: false });
          return;
        }
      }
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      if (Math.hypot(p.x - this.px, p.y - this.py) < 24) {
        if (p.kind === 'spread') {
          this.spreadTimer = 7.5;
          this.ctx.toast('DISPARO TRIPLE ACTIVADO', 'accent');
        } else {
          this.ctx.heal(1);
          this.ctx.toast('ESCUDO +1', 'good');
        }
        synthAudio.pickup();
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) this.pickups.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    this.ctx.setHud({
      subStat: `BAJAS ${this.kills} · ${this.spreadTimer > 0 ? 'TRIPLE ' + Math.ceil(this.spreadTimer) + 's' : 'IMPULSO LISTO'}`,
    });

    this.draw();
  }

  private killEnemy(idx: number): void {
    const en = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.kills += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const pts = en.kind === 'splitter' ? 190 : en.kind === 'charger' ? 150 : 100;
    this.score += pts;
    this.ctx.addScore(pts, 1);
    synthAudio.bullseye(this.combo);
    this.spawnParticles(en.x, en.y, en.color, 12);

    if (en.kind === 'splitter') {
      for (const sign of [-1, 1]) {
        this.enemies.push({
          x: en.x + sign * 16,
          y: en.y + sign * 10,
          vx: 0,
          vy: 0,
          r: 9,
          hp: 1,
          maxHp: 1,
          kind: 'mini',
          color: '#00E5FF',
          chargeState: 0,
          chargeTimer: 0,
        });
      }
    }

    if (Math.random() < 0.12) {
      this.pickups.push({
        x: en.x,
        y: en.y,
        kind: Math.random() < 0.65 ? 'spread' : 'shield',
        life: 8,
      });
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 170;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.34, color });
    }
  }

  private draw(): void {
    const g = this.g;
    g.fillStyle = '#090C12';
    g.fillRect(0, 0, this.width, this.height);

    // Arena grid
    g.strokeStyle = '#151D2B';
    g.lineWidth = 1;
    for (let x = 0; x < this.width; x += 48) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, this.height);
      g.stroke();
    }
    for (let y = 0; y < this.height; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.width, y);
      g.stroke();
    }

    // Pickups
    for (const p of this.pickups) {
      g.strokeStyle = p.kind === 'spread' ? '#00E5FF' : '#A6FF00';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 11, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = p.kind === 'spread' ? '#00E5FF' : '#A6FF00';
      g.font = '700 11px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.kind === 'spread' ? '3X' : '+1', p.x, p.y);
    }

    // Enemies
    for (const en of this.enemies) {
      g.fillStyle = en.chargeState === 1 ? '#FFFFFF' : en.color;
      g.beginPath();
      g.arc(en.x, en.y, en.r, 0, Math.PI * 2);
      g.fill();
      if (en.maxHp > 1) {
        g.strokeStyle = '#090C12';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(en.x, en.y, en.r * 0.52, 0, Math.PI * 2 * (en.hp / en.maxHp));
        g.stroke();
      }
    }

    // Bullets
    g.fillStyle = '#FFB800';
    for (const b of this.bullets) {
      g.beginPath();
      g.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
      g.fill();
    }

    // Player
    if (this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0) {
      const ang = Math.atan2(this.aimY - this.py, this.aimX - this.px);
      g.save();
      g.translate(this.px, this.py);
      g.rotate(ang);
      g.fillStyle = '#FF6B4A';
      g.beginPath();
      g.moveTo(16, 0);
      g.lineTo(-11, -11);
      g.lineTo(-6, 0);
      g.lineTo(-11, 11);
      g.closePath();
      g.fill();
      g.restore();
    }

    // Aim reticle on desktop
    if (!this.ctx.isTouch) {
      g.strokeStyle = 'rgba(255, 107, 74, 0.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(this.aimX, this.aimY, 10, 0, Math.PI * 2);
      g.stroke();
    }

    // Particles
    for (const pt of this.particles) {
      g.globalAlpha = Math.max(0, pt.life / 0.34);
      g.fillStyle = pt.color;
      g.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    g.globalAlpha = 1;
  }

  public onResize(): void {
    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const acc = this.shots > 0 ? Math.min(100, (this.hits / this.shots) * 100) : 100;
    const aimPerf = Math.max(
      180,
      Math.min(1000, Math.round(220 + this.kills * 16 + acc * 2.4))
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      hits: this.kills,
      survived: true,
      axisPerformances: {
        aim: aimPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.wrapper.remove();
  }
}
