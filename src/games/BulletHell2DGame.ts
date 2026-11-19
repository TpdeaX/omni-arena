import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  grazed: boolean;
}

interface SniperBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  warnLeft: number;
  activeLeft: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class BulletHell2DGame implements MiniGame {
  public readonly id = 'bullet2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;

  private width = 800;
  private height = 520;
  private dpr = 1;

  private px = 400;
  private py = 380;
  private readonly playerRadius = 5.5;
  private readonly grazeRadius = 28;
  private invuln = 0;

  private keys = new Set<string>();
  private pointerActive = false;
  private pointerOrigin = { x: 0, y: 0 };
  private touchVec = { x: 0, y: 0 };

  private bullets: Bullet[] = [];
  private beams: SniperBeam[] = [];
  private sparks: Spark[] = [];

  private emitterAngle = 0;
  private spiralTimer = 0;
  private ringTimer = 1.6;
  private beamTimer = 3.4;

  private elapsed = 0;
  private grazes = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;

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
    this.py = this.height * 0.74;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'LLUVIA Y ROCE',
      accent: '#65A30D',
      timeLeftSec: null,
      subStat: 'ROCES 0 · SHIFT PREC.',
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    synthAudio.ensure();
    this.pointerActive = true;
    this.pointerOrigin = { x: e.clientX, y: e.clientY };
    this.touchVec = { x: 0, y: 0 };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive) return;
    const dx = e.clientX - this.pointerOrigin.x;
    const dy = e.clientY - this.pointerOrigin.y;
    const dist = Math.hypot(dx, dy);
    const maxD = 42;
    if (dist > 3) {
      const mag = Math.min(1, dist / maxD);
      this.touchVec = { x: (dx / dist) * mag, y: (dy / dist) * mag };
    } else {
      this.touchVec = { x: 0, y: 0 };
    }
  };

  private onPointerUp = (): void => {
    this.pointerActive = false;
    this.touchVec = { x: 0, y: 0 };
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    // Survival score ticks
    const survPts = Math.round(dt * 45);
    this.score += survPts;
    this.ctx.addScore(survPts, 0);

    // Player movement
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
    if (this.pointerActive) {
      mx = this.touchVec.x;
      my = this.touchVec.y;
    }

    const focus = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const moveSpeed = focus ? 175 : 340;
    this.px = Math.max(20, Math.min(this.width - 20, this.px + mx * moveSpeed * dt));
    this.py = Math.max(20, Math.min(this.height - 20, this.py + my * moveSpeed * dt));

    if (this.invuln > 0) this.invuln -= dt;

    const isProgressive = this.ctx.difficulty === 'progressive';
    const timeRamp = isProgressive
      ? Math.min(2.2, this.elapsed * 0.036)
      : Math.min(1.4, this.elapsed * 0.032);
    const difficulty =
      (1 + timeRamp + (this.isGauntletSlice ? 0.2 : 0)) * this.ctx.getIntensity();
    const cx = this.width / 2;
    const cy = Math.max(78, this.height * 0.2);

    // Pattern 1: Spiral emitter
    this.emitterAngle += dt * 2.1 * Math.min(3.2, difficulty);
    this.spiralTimer -= dt;
    if (this.spiralTimer <= 0) {
      this.spiralTimer = Math.max(isProgressive ? 0.072 : 0.085, 0.17 / Math.sqrt(difficulty));
      const arms = difficulty > 2.6 ? 5 : difficulty > 1.7 ? 4 : 3;
      const spd = 165 * Math.sqrt(Math.min(3.5, difficulty));
      for (let a = 0; a < arms; a++) {
        const ang = this.emitterAngle + (a * Math.PI * 2) / arms;
        this.bullets.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: 6,
          color: '#FF4D38',
          grazed: false,
        });
      }
    }

    // Pattern 2: Aimed burst ring
    this.ringTimer -= dt;
    if (this.ringTimer <= 0) {
      this.ringTimer = Math.max(isProgressive ? 1.25 : 1.5, 2.7 - difficulty * 0.35);
      const count = difficulty > 2.4 ? 16 : difficulty > 1.8 ? 14 : 12;
      const baseAng = Math.atan2(this.py - cy, this.px - cx);
      for (let i = 0; i < count; i++) {
        const ang = baseAng + (i * Math.PI * 2) / count;
        this.bullets.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * 215,
          vy: Math.sin(ang) * 215,
          r: 7,
          color: '#FFB800',
          grazed: false,
        });
      }
    }

    // Pattern 3: Telegraphed sniper laser
    this.beamTimer -= dt;
    if (this.beamTimer <= 0) {
      this.beamTimer = Math.max(isProgressive ? 1.65 : 2.2, 4.0 - difficulty * 0.45);
      const fromLeft = Math.random() < 0.5;
      const sx = fromLeft ? 0 : this.width;
      const sy = Math.random() * this.height * 0.7;
      const ang = Math.atan2(this.py - sy, this.px - sx);
      this.beams.push({
        x1: sx,
        y1: sy,
        x2: sx + Math.cos(ang) * 1600,
        y2: sy + Math.sin(ang) * 1600,
        warnLeft: 0.85,
        activeLeft: 0.24,
      });
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -30 || b.x > this.width + 30 || b.y < -30 || b.y > this.height + 30) {
        this.bullets.splice(i, 1);
        continue;
      }

      const d = Math.hypot(b.x - this.px, b.y - this.py);
      if (d < b.r + this.playerRadius) {
        this.bullets.splice(i, 1);
        if (this.invuln <= 0 && this.takeHit()) return;
      } else if (!b.grazed && d < b.r + this.grazeRadius) {
        b.grazed = true;
        this.grazes += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 40;
        this.ctx.addScore(40, 1);
        synthAudio.graze();
        this.spawnSparks(this.px, this.py, '#A6FF00', 4);
      }
    }

    // Update sniper beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i];
      if (bm.warnLeft > 0) {
        bm.warnLeft -= dt;
      } else {
        bm.activeLeft -= dt;
        if (this.invuln <= 0 && this.pointLineDist(this.px, this.py, bm.x1, bm.y1, bm.x2, bm.y2) < 11) {
          if (this.takeHit()) return;
        }
        if (bm.activeLeft <= 0) {
          this.beams.splice(i, 1);
        }
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    this.ctx.setHud({
      subStat: `ROCES ${this.grazes} · PROYECTILES ${this.bullets.length}`,
    });

    this.draw(focus);
  }

  private takeHit(): boolean {
    this.invuln = 1.25;
    this.combo = 0;
    this.ctx.breakCombo();
    synthAudio.damage();
    this.spawnSparks(this.px, this.py, '#FF4D38', 14);
    this.ctx.toast('IMPACTO -1 ESCUDO', 'bad');
    const left = this.ctx.damage(1);
    if (left <= 0) {
      this.ctx.finish({ ...this.getMetrics(), survived: false });
      return true;
    }
    return false;
  }

  private pointLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  private spawnSparks(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 140;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, color });
    }
  }

  private draw(focus: boolean): void {
    const g = this.g;
    g.fillStyle = '#090C12';
    g.fillRect(0, 0, this.width, this.height);

    // Subtle tactical grid
    g.strokeStyle = '#141B29';
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

    // Boss emitter
    const cx = this.width / 2;
    const cy = Math.max(78, this.height * 0.2);
    g.save();
    g.translate(cx, cy);
    g.rotate(this.emitterAngle);
    g.strokeStyle = '#FF4D38';
    g.lineWidth = 2.5;
    g.strokeRect(-18, -18, 36, 36);
    g.rotate(Math.PI / 4);
    g.strokeStyle = '#FFB800';
    g.strokeRect(-14, -14, 28, 28);
    g.restore();

    // Sniper beams
    for (const bm of this.beams) {
      g.beginPath();
      g.moveTo(bm.x1, bm.y1);
      g.lineTo(bm.x2, bm.y2);
      if (bm.warnLeft > 0) {
        g.setLineDash([8, 8]);
        g.strokeStyle = 'rgba(255, 77, 56, 0.5)';
        g.lineWidth = 2;
      } else {
        g.setLineDash([]);
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 12;
      }
      g.stroke();
      g.setLineDash([]);
    }

    // Bullets
    for (const b of this.bullets) {
      g.fillStyle = b.color;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2);
      g.fill();
    }

    // Player Graze ring & Core
    if (this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0) {
      g.strokeStyle = focus ? 'rgba(166, 255, 0, 0.7)' : 'rgba(166, 255, 0, 0.22)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(this.px, this.py, this.grazeRadius, 0, Math.PI * 2);
      g.stroke();

      // Ship diamond
      g.fillStyle = '#A6FF00';
      g.beginPath();
      g.moveTo(this.px, this.py - 14);
      g.lineTo(this.px + 11, this.py + 10);
      g.lineTo(this.px, this.py + 5);
      g.lineTo(this.px - 11, this.py + 10);
      g.closePath();
      g.fill();

      // True core hitbox
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(this.px, this.py, this.playerRadius, 0, Math.PI * 2);
      g.fill();
    }

    // Sparks
    for (const s of this.sparks) {
      g.globalAlpha = Math.max(0, s.life / 0.35);
      g.fillStyle = s.color;
      g.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    g.globalAlpha = 1;

    // Touch joystick indicator
    if (this.pointerActive) {
      g.strokeStyle = 'rgba(166, 255, 0, 0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.pointerOrigin.x - this.canvas.getBoundingClientRect().left, this.pointerOrigin.y - this.canvas.getBoundingClientRect().top, 36, 0, Math.PI * 2);
      g.stroke();
    }
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
    const reflexPerf =
      this.elapsed < 3 && this.grazes === 0
        ? 140
        : Math.max(
            140,
            Math.min(1000, Math.round(140 + this.elapsed * 11.5 + this.grazes * 15))
          );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.grazes,
      grazes: this.grazes,
      survived: true,
      axisPerformances: {
        reflex: reflexPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.wrapper.remove();
  }
}
