import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

type ThreatLane = 0 | 1 | 2; // 0: Left, 1: Center/Top, 2: Right

interface ThreatAttack {
  lane: ThreatLane;
  progress: number; // 0 (edge) -> 1 (strike point)
  duration: number;
  flashAt: number; // ~0.78
  isFeint: boolean;
  flashed: boolean;
  resolved: boolean;
}

interface ShockFx {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
}

const LANE_NAMES = ['IZQ [A / Izq]', 'CENTRO [W / Arr]', 'DER [D / Der]'];

export class FlashParry2DGame implements MiniGame {
  public readonly id = 'parry2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;

  private width = 800;
  private height = 520;
  private dpr = 1;

  private activeThreat: ThreatAttack | null = null;
  private spawnDelay = 0.65;
  private laneFlash = [0, 0, 0];
  private shockFx: ShockFx[] = [];
  private centerMsg = { text: 'ESPERA EL DESTELLO BLANCO', color: '#A2B1C7', life: 2 };

  private parries = 0;
  private misses = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 45;
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
    window.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'DUELO DE REFLEJO',
      accent: '#FFB800',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'PARRIES 0 · ESPERA DESTELLO',
    });
  }

  private laneOrigin(lane: ThreatLane): { x: number; y: number } {
    const cx = this.width / 2;
    const cy = this.height * 0.62;
    const dist = Math.min(this.width * 0.38, this.height * 0.48);
    if (lane === 0) return { x: cx - dist, y: cy - dist * 0.15 };
    if (lane === 1) return { x: cx, y: Math.max(60, cy - dist * 0.95) };
    return { x: cx + dist, y: cy - dist * 0.15 };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || this.paused || this.destroyed) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      e.preventDefault();
      this.attemptParry(0);
    } else if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
      e.preventDefault();
      this.attemptParry(1);
    } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      e.preventDefault();
      this.attemptParry(2);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.paused || this.destroyed) return;
    synthAudio.ensure();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relX = x / Math.max(1, rect.width);
    const lane: ThreatLane = relX < 0.34 ? 0 : relX > 0.66 ? 2 : 1;
    this.attemptParry(lane);
  };

  private attemptParry(lane: ThreatLane): void {
    synthAudio.ensure();
    this.laneFlash[lane] = 1;

    const th = this.activeThreat;
    if (!th || th.resolved) {
      return;
    }

    if (th.isFeint) {
      th.resolved = true;
      this.triggerFail('CAÍSTE EN LA FINTA');
      return;
    }

    if (th.lane !== lane) {
      th.resolved = true;
      this.triggerFail('DIRECCIÓN INCORRECTA');
      return;
    }

    // Timing evaluation around flashAt .. 1.02
    const timeSinceFlashSec = (th.progress - th.flashAt) * th.duration;
    const absMs = Math.abs(timeSinceFlashSec * 1000);
    const windowMs = Math.max(95, 165 / Math.sqrt(this.ctx.getIntensity()));

    if (th.progress >= th.flashAt - 0.12 && absMs <= windowMs) {
      th.resolved = true;
      const rxMs = Math.max(40, Math.round(Math.max(0, timeSinceFlashSec) * 1000));
      this.reactionSamples.push(rxMs);
      this.parries += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      const isPerfect = absMs <= 75;
      const pts = isPerfect ? 260 : 170;
      this.score += pts;
      this.ctx.addScore(pts, 1);

      synthAudio.bullseye(this.combo);
      const cx = this.width / 2;
      const cy = this.height * 0.62;
      this.shockFx.push({
        x: cx,
        y: cy,
        r: 18,
        maxR: 150,
        color: isPerfect ? '#00E5FF' : '#A6FF00',
        life: 0.35,
      });
      this.centerMsg = {
        text: isPerfect ? `PARRY PERFECTO · ${rxMs}ms` : `BLOQUEO · ${rxMs}ms`,
        color: isPerfect ? '#00E5FF' : '#A6FF00',
        life: 0.85,
      };
      this.activeThreat = null;
      this.spawnDelay = Math.max(0.2, 0.55 / Math.max(0.8, this.effectiveIntensity()));
      this.updateHudStats();
    } else {
      th.resolved = true;
      this.triggerFail(th.progress < th.flashAt ? 'MUY PRONTO' : 'MUY TARDE');
    }
  }

  private triggerFail(reason: string): void {
    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    synthAudio.damage();
    this.centerMsg = { text: reason, color: '#FF4D38', life: 0.9 };
    this.ctx.toast(`${reason} -1 ESCUDO`, 'bad');
    this.activeThreat = null;
    this.spawnDelay = 0.65;
    this.updateHudStats();

    const left = this.ctx.damage(1);
    if (left <= 0) {
      this.ctx.finish({ ...this.getMetrics(), survived: false });
    }
  }

  private updateHudStats(): void {
    const total = this.parries + this.misses;
    const acc = total > 0 ? Math.round((this.parries / total) * 100) : 100;
    const avgMs = this.reactionSamples.length
      ? Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length)
      : 0;
    this.ctx.setHud({
      subStat: `PARRIES ${this.parries} · PREC ${acc}%${avgMs ? ` · ${avgMs}ms` : ''}`,
    });
  }

  private effectiveIntensity(): number {
    const base = this.ctx.getIntensity();
    const prog =
      this.ctx.infiniteMode || this.ctx.difficulty === 'progressive'
        ? Math.min(0.55, this.parries * 0.015)
        : 0;
    return base + prog;
  }

  private spawnThreat(): void {
    const intensity = this.effectiveIntensity();
    const lane = Math.floor(Math.random() * 3) as ThreatLane;
    const isFeint = this.parries >= 2 && Math.random() < Math.min(0.32, 0.14 * intensity);
    const minDuration = this.ctx.infiniteMode || this.ctx.difficulty === 'progressive' ? 0.46 : 0.55;
    const duration = Math.max(minDuration, 1.05 / Math.pow(intensity, 0.72));
    this.activeThreat = {
      lane,
      progress: 0,
      duration,
      flashAt: 0.72,
      isFeint,
      flashed: false,
      resolved: false,
    };
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice && !this.ctx.infiniteMode) {
      const rem = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: rem });
      if (rem <= 0) {
        this.ctx.finish(this.getMetrics());
        return;
      }
    }

    for (let i = 0; i < 3; i++) {
      this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 4.5);
    }
    if (this.centerMsg.life > 0) this.centerMsg.life -= dt;

    for (let i = this.shockFx.length - 1; i >= 0; i--) {
      const s = this.shockFx[i];
      s.life -= dt;
      s.r += (s.maxR - s.r) * Math.min(1, dt * 12);
      if (s.life <= 0) this.shockFx.splice(i, 1);
    }

    if (!this.activeThreat) {
      this.spawnDelay -= dt;
      if (this.spawnDelay <= 0) {
        this.spawnThreat();
      }
    } else {
      const th = this.activeThreat;
      th.progress += dt / th.duration;

      if (!th.flashed && th.progress >= th.flashAt) {
        th.flashed = true;
        if (th.isFeint) {
          synthAudio.uiClick();
        } else {
          synthAudio.scheduleNoteCue(3);
        }
      }

      // Feint aborts harmlessly at 0.88 if player resisted!
      if (th.isFeint && th.progress >= 0.88) {
        this.parries += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 120;
        this.ctx.addScore(120, 1);
        this.centerMsg = { text: 'FINTA ESQUIVADA +120', color: '#A6FF00', life: 0.7 };
        this.activeThreat = null;
        this.spawnDelay = Math.max(0.24, 0.38 / Math.max(0.85, this.effectiveIntensity()));
        this.updateHudStats();
      } else if (!th.isFeint && th.progress >= 1.05) {
        this.triggerFail('IMPACTO SIN BLOQUEO');
        return;
      }
    }

    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.fillStyle = '#090C12';
    g.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height * 0.62;

    // 3 sector zones
    const zones = [
      { x: 0, w: this.width * 0.34, lane: 0 as ThreatLane },
      { x: this.width * 0.34, w: this.width * 0.32, lane: 1 as ThreatLane },
      { x: this.width * 0.66, w: this.width * 0.34, lane: 2 as ThreatLane },
    ];
    for (const z of zones) {
      if (this.laneFlash[z.lane] > 0) {
        g.fillStyle = `rgba(0, 229, 255, ${this.laneFlash[z.lane] * 0.16})`;
        g.fillRect(z.x, 0, z.w, this.height);
      }
      g.strokeStyle = '#1B2434';
      g.lineWidth = 1;
      g.strokeRect(z.x, 0, z.w, this.height);

      g.fillStyle = '#6F8099';
      g.font = '700 12px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      g.fillText(this.ctx.isTouch ? 'TOCAR ZONA' : LANE_NAMES[z.lane], z.x + z.w / 2, this.height - 26);
    }

    // Guide lines to center core
    for (const lane of [0, 1, 2] as ThreatLane[]) {
      const orig = this.laneOrigin(lane);
      g.strokeStyle = '#253147';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(orig.x, orig.y);
      g.lineTo(cx, cy);
      g.stroke();

      g.fillStyle = '#1A2334';
      g.beginPath();
      g.arc(orig.x, orig.y, 16, 0, Math.PI * 2);
      g.fill();
    }

    // Player core
    g.strokeStyle = '#00E5FF';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 26, 0, Math.PI * 2);
    g.stroke();

    // Active Threat
    if (this.activeThreat) {
      const th = this.activeThreat;
      const orig = this.laneOrigin(th.lane);
      const t = Math.min(1, th.progress);
      const tx = orig.x + (cx - orig.x) * t;
      const ty = orig.y + (cy - orig.y) * t;

      // Timing closing ring around target
      const ringR = Math.max(18, (1 - Math.min(1, t / th.flashAt)) * 70 + 18);
      g.strokeStyle = th.isFeint ? '#FF7A00' : th.flashed ? '#FFFFFF' : '#FF4D38';
      g.lineWidth = th.flashed && !th.isFeint ? 4 : 2;
      g.beginPath();
      g.arc(tx, ty, ringR, 0, Math.PI * 2);
      g.stroke();

      // Attacker blade/orb
      g.fillStyle = th.isFeint ? '#FF7A00' : th.flashed ? '#FFFFFF' : '#FF4D38';
      g.beginPath();
      g.arc(tx, ty, th.flashed && !th.isFeint ? 20 : 14, 0, Math.PI * 2);
      g.fill();

      if (th.flashed && !th.isFeint) {
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(tx - 34, ty);
        g.lineTo(tx + 34, ty);
        g.moveTo(tx, ty - 34);
        g.lineTo(tx, ty + 34);
        g.stroke();
      } else if (th.isFeint && th.flashed) {
        g.fillStyle = '#FFB800';
        g.font = '700 13px "Chakra Petch", sans-serif';
        g.textAlign = 'center';
        g.fillText('¡FINTA!', tx, ty - 26);
      }
    }

    // Shockwaves
    for (const s of this.shockFx) {
      g.globalAlpha = Math.max(0, s.life / 0.35);
      g.strokeStyle = s.color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // Center feedback text
    if (this.centerMsg.life > 0) {
      g.fillStyle = this.centerMsg.color;
      g.font = '700 18px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      g.fillText(this.centerMsg.text, cx, cy + 56);
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
    const total = this.parries + this.misses;
    const acc = total > 0 ? (this.parries / total) * 100 : 0;
    const avgRx = this.reactionSamples.length
      ? this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length
      : 220;
    const rxScore = Math.max(0, (300 - avgRx) * 1.4);
    const reflexPerf =
      total === 0
        ? 150
        : Math.max(160, Math.min(1000, Math.round(rxScore + acc * 4.5 + this.parries * 18)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: avgRx,
      hits: this.parries,
      misses: this.misses,
      survived: true,
      axisPerformances: {
        reflex: reflexPerf,
        rhythm: Math.round(reflexPerf * 0.85),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.wrapper.remove();
  }
}
