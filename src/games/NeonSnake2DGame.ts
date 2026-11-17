import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface Pt {
  x: number;
  y: number;
}

export class NeonSnake2DGame implements MiniGame {
  public readonly id = 'snake2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;

  private readonly cols = 20;
  private readonly rows = 14;
  private snake: Pt[] = [];
  private dir: Pt = { x: 1, y: 0 };
  private nextDir: Pt = { x: 1, y: 0 };
  private food: Pt = { x: 14, y: 7 };
  private bonusFood: Pt | null = null;
  private bonusTimer = 0;

  private stepAcc = 0;
  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private readonly standaloneDuration = 60;
  private isGauntletSlice = false;

  private touchStart: Pt | null = null;
  private paused = false;
  private destroyed = false;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-2d';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'oa-canvas-2d';
    this.wrapper.appendChild(this.canvas);
    this.ctx.container.appendChild(this.wrapper);
    this.c2d = this.canvas.getContext('2d')!;

    this.resetSnake();
    this.onResize();

    window.addEventListener('keydown', this.onKeyDown);
    this.wrapper.addEventListener('pointerdown', this.onPointerDown);
    this.wrapper.addEventListener('pointerup', this.onPointerUp);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'SERPIENTE NEÓN',
      accent: '#10B981',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: 'ORBES 0 · LARGO 4',
    });
  }

  private resetSnake(): void {
    this.snake = [
      { x: 6, y: 7 },
      { x: 5, y: 7 },
      { x: 4, y: 7 },
      { x: 3, y: 7 },
    ];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.spawnFood();
  }

  private spawnFood(): void {
    const occupied = new Set(this.snake.map((p) => `${p.x},${p.y}`));
    const free: Pt[] = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (free.length > 0) {
      this.food = free[Math.floor(Math.random() * free.length)];
    }
    if (!this.bonusFood && Math.random() < 0.25 && free.length > 1) {
      this.bonusFood = free[Math.floor(Math.random() * free.length)];
      this.bonusTimer = 5.5;
    }
  }

  private setDirection(dx: number, dy: number): void {
    if (dx !== 0 && this.dir.x === -dx) return;
    if (dy !== 0 && this.dir.y === -dy) return;
    this.nextDir = { x: dx, y: dy };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setDirection(-1, 0);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setDirection(1, 0);
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.setDirection(0, -1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.setDirection(0, 1);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.touchStart = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.touchStart) return;
    const dx = e.clientX - this.touchStart.x;
    const dy = e.clientY - this.touchStart.y;
    this.touchStart = null;
    if (Math.hypot(dx, dy) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      this.setDirection(0, dy > 0 ? 1 : -1);
    }
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice) {
      const left = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: left });
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(true));
        return;
      }
    }

    if (this.bonusFood) {
      this.bonusTimer -= dt;
      if (this.bonusTimer <= 0) this.bonusFood = null;
    }

    const intensity = this.ctx.getIntensity();
    const stepTime = Math.max(0.068, (0.135 - Math.min(0.04, this.hits * 0.002)) / Math.max(0.8, intensity));
    this.stepAcc += dt;
    while (this.stepAcc >= stepTime) {
      this.stepAcc -= stepTime;
      this.stepSnake();
      if (this.destroyed) return;
    }

    this.draw();
  }

  private stepSnake(): void {
    this.dir = this.nextDir;
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    const hitWall = nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows;
    const hitSelf = this.snake.some((s, i) => i < this.snake.length - 1 && s.x === nx && s.y === ny);

    if (hitWall || hitSelf) {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(false));
        return;
      }
      this.resetSnake();
      return;
    }

    const nextHead = { x: nx, y: ny };
    this.snake.unshift(nextHead);

    let ate = false;
    if (nx === this.food.x && ny === this.food.y) {
      ate = true;
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 110;
      this.ctx.addScore(110, 1);
      synthAudio.pickup();
      this.spawnFood();
    } else if (this.bonusFood && nx === this.bonusFood.x && ny === this.bonusFood.y) {
      ate = true;
      this.bonusFood = null;
      this.hits += 1;
      this.combo += 2;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 240;
      this.ctx.addScore(240, 2);
      synthAudio.pickup();
    }

    if (!ate) {
      this.snake.pop();
    }

    this.ctx.setHud({
      subStat: `ORBES ${this.hits} · LARGO ${this.snake.length}`,
    });
  }

  private draw(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const g = this.c2d;
    g.fillStyle = '#090E17';
    g.fillRect(0, 0, w, h);

    const cell = Math.floor(Math.min(w / this.cols, h / this.rows) * 0.9);
    const ox = Math.floor((w - cell * this.cols) / 2);
    const oy = Math.floor((h - cell * this.rows) / 2);

    g.strokeStyle = 'rgba(16, 185, 129, 0.12)';
    g.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      g.beginPath();
      g.moveTo(ox + x * cell, oy);
      g.lineTo(ox + x * cell, oy + this.rows * cell);
      g.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      g.beginPath();
      g.moveTo(ox, oy + y * cell);
      g.lineTo(ox + this.cols * cell, oy + y * cell);
      g.stroke();
    }

    g.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    g.lineWidth = 2;
    g.strokeRect(ox, oy, this.cols * cell, this.rows * cell);

    // Food
    g.fillStyle = '#38BDF8';
    g.beginPath();
    g.arc(ox + (this.food.x + 0.5) * cell, oy + (this.food.y + 0.5) * cell, cell * 0.34, 0, Math.PI * 2);
    g.fill();

    // Bonus food
    if (this.bonusFood) {
      g.fillStyle = '#FBBF24';
      g.beginPath();
      g.arc(ox + (this.bonusFood.x + 0.5) * cell, oy + (this.bonusFood.y + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
      g.fill();
    }

    // Snake
    this.snake.forEach((seg, idx) => {
      g.fillStyle = idx === 0 ? '#34D399' : '#059669';
      const pad = idx === 0 ? 2 : 3;
      g.fillRect(ox + seg.x * cell + pad, oy + seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
    });
  }

  public onResize(): void {
    const rect = this.wrapper.getBoundingClientRect();
    this.canvas.width = Math.max(320, Math.floor(rect.width || 800));
    this.canvas.height = Math.max(260, Math.floor(rect.height || 520));
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(survived = true): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const accuracy = total > 0 ? (this.hits / total) * 100 : 100;
    const reflexScore = Math.min(980, 260 + this.hits * 34 + this.maxCombo * 14 - this.misses * 40);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      hits: this.hits,
      misses: this.misses,
      survived,
      axisPerformances: {
        reflex: Math.max(120, reflexScore),
        agility: Math.max(120, Math.round(reflexScore * 0.9)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.removeEventListener('pointerdown', this.onPointerDown);
    this.wrapper.removeEventListener('pointerup', this.onPointerUp);
    this.wrapper.remove();
  }
}
