import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

type ShapeMatrix = number[][];

const TETROMINOES: { shape: ShapeMatrix; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#00E5FF' }, // I
  { shape: [[1, 1], [1, 1]], color: '#FFB800' }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#7B61FF' }, // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#A6FF00' }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#FF4D38' }, // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#3E8BFF' }, // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#FF7A00' }, // L
];

const COLS = 10;
const ROWS = 18;

export class BlitzStacker2DGame implements MiniGame {
  public readonly id = 'tetris2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private touchPadEl: HTMLDivElement | null = null;

  private width = 800;
  private height = 520;
  private dpr = 1;

  private board: (string | null)[][] = [];
  private bag: number[] = [];
  private currIndex = 0;
  private currShape: ShapeMatrix = [];
  private currColor = '#00E5FF';
  private currX = 3;
  private currY = 0;

  private nextIndex = 0;
  private holdIndex: number | null = null;
  private holdUsed = false;

  private dropTimer = 0;
  private linesCleared = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private flashRows: number[] = [];
  private flashTimer = 0;

  private paused = false;
  private destroyed = false;

  constructor(_isSlice = false) {}

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-2d';
    this.ctx.container.appendChild(this.wrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'oa-canvas-2d';
    this.wrapper.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d')!;

    this.board = Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
    this.nextIndex = this.pullFromBag();
    this.spawnPiece();

    if (this.ctx.isTouch) {
      this.buildTouchControls();
    }

    this.onResize();
    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'BLITZ STACKER',
      accent: '#7B61FF',
      timeLeftSec: null,
      subStat: 'LÍNEAS 0 · ESPACIO DROP · C HOLD',
    });
  }

  private buildTouchControls(): void {
    this.touchPadEl = document.createElement('div');
    this.touchPadEl.className = 'oa-touch-tetris';
    this.touchPadEl.innerHTML = `
      <button type="button" data-act="left">◀</button>
      <button type="button" data-act="rot">ROTAR</button>
      <button type="button" data-act="right">▶</button>
      <button type="button" data-act="hold">HOLD</button>
      <button type="button" data-act="drop">DROP</button>
    `;
    this.touchPadEl.addEventListener('pointerdown', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || this.paused) return;
      e.preventDefault();
      synthAudio.ensure();
      const act = btn.dataset.act;
      if (act === 'left') this.move(-1, 0);
      if (act === 'right') this.move(1, 0);
      if (act === 'rot') this.rotatePiece();
      if (act === 'hold') this.doHold();
      if (act === 'drop') this.hardDrop();
    });
    this.wrapper.appendChild(this.touchPadEl);
  }

  private pullFromBag(): number {
    if (this.bag.length === 0) {
      this.bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    }
    return this.bag.pop()!;
  }

  private spawnPiece(forcedIdx?: number): void {
    const idx = forcedIdx ?? this.nextIndex;
    if (forcedIdx === undefined) {
      this.nextIndex = this.pullFromBag();
    }
    this.currIndex = idx;
    const def = TETROMINOES[idx];
    this.currShape = def.shape.map((r) => [...r]);
    this.currColor = def.color;
    this.currX = Math.floor((COLS - this.currShape[0].length) / 2);
    this.currY = 0;
    this.holdUsed = false;

    if (this.collides(this.currX, this.currY, this.currShape)) {
      // Top-out emergency purge instead of instant death unless shields == 0
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.ctx.toast('COLUMNA LLENA · PURGA -1 ESCUDO', 'bad');
      this.board.splice(0, 8);
      for (let i = 0; i < 8; i++) {
        this.board.unshift(Array<string | null>(COLS).fill(null));
      }
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish({ ...this.getMetrics(), survived: false });
      }
    }
  }

  private collides(nx: number, ny: number, shape: ShapeMatrix): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = nx + c;
        const by = ny + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by][bx] !== null) return true;
      }
    }
    return false;
  }

  private move(dx: number, dy: number): boolean {
    if (!this.collides(this.currX + dx, this.currY + dy, this.currShape)) {
      this.currX += dx;
      this.currY += dy;
      if (dx !== 0) synthAudio.uiClick();
      return true;
    }
    return false;
  }

  private rotatePiece(): void {
    const rows = this.currShape.length;
    const cols = this.currShape[0].length;
    const rotated: ShapeMatrix = Array.from({ length: cols }, (_, c) =>
      Array.from({ length: rows }, (__, r) => this.currShape[rows - 1 - r][c])
    );

    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.collides(this.currX + kick, this.currY, rotated)) {
        this.currShape = rotated;
        this.currX += kick;
        synthAudio.uiClick();
        return;
      }
    }
  }

  private doHold(): void {
    if (this.holdUsed) return;
    const prevHold = this.holdIndex;
    this.holdIndex = this.currIndex;
    this.holdUsed = true;
    synthAudio.uiClick();
    if (prevHold !== null) {
      this.spawnPiece(prevHold);
      this.holdUsed = true;
    } else {
      this.spawnPiece();
      this.holdUsed = true;
    }
  }

  private hardDrop(): void {
    let dist = 0;
    while (this.move(0, 1)) {
      dist += 1;
    }
    if (dist > 0) {
      const pts = dist * 4;
      this.score += pts;
      this.ctx.addScore(pts, 0);
    }
    this.lockPiece();
  }

  private lockPiece(): void {
    for (let r = 0; r < this.currShape.length; r++) {
      for (let c = 0; c < this.currShape[r].length; c++) {
        if (!this.currShape[r][c]) continue;
        const by = this.currY + r;
        const bx = this.currX + c;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          this.board[by][bx] = this.currColor;
        }
      }
    }

    // Check line clears
    const cleared: number[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((cell) => cell !== null)) {
        cleared.push(r);
      }
    }

    if (cleared.length > 0) {
      this.flashRows = cleared;
      this.flashTimer = 0.16;
      for (const r of cleared) {
        this.board.splice(r, 1);
      }
      for (let i = 0; i < cleared.length; i++) {
        this.board.unshift(Array<string | null>(COLS).fill(null));
      }

      this.linesCleared += cleared.length;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      const linePts = [0, 180, 420, 750, 1200][cleared.length] ?? 1200;
      this.score += linePts;
      this.ctx.addScore(linePts, cleared.length);
      synthAudio.puzzleSuccess(this.combo);

      if (cleared.length >= 2) {
        const names = ['', '', 'DOBLE!', 'TRIPLE!', 'OMNI TETRIS!'];
        this.ctx.toast(`${names[cleared.length]} +${linePts}`, 'good');
      }
    } else {
      synthAudio.hitmarker(1);
    }

    this.ctx.setHud({
      subStat: `LÍNEAS ${this.linesCleared} · COMBO ${this.combo}`,
    });

    this.spawnPiece();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      this.move(-1, 0);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      this.move(1, 0);
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      if (!this.move(0, 1)) this.lockPiece();
    } else if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) {
      e.preventDefault();
      this.rotatePiece();
    } else if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.hardDrop();
    } else if ((e.code === 'KeyC' || e.code === 'ShiftLeft') && !e.repeat) {
      e.preventDefault();
      this.doHold();
    }
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;

    if (this.flashTimer > 0) this.flashTimer -= dt;

    const intensity = this.ctx.getIntensity();
    const fallInterval = Math.max(0.14, 0.56 / intensity);
    this.dropTimer += dt;
    if (this.dropTimer >= fallInterval) {
      this.dropTimer = 0;
      if (!this.move(0, 1)) {
        this.lockPiece();
      }
    }

    this.draw();
  }

  private ghostY(): number {
    let gy = this.currY;
    while (!this.collides(this.currX, gy + 1, this.currShape)) {
      gy += 1;
    }
    return gy;
  }

  private draw(): void {
    const g = this.g;
    g.fillStyle = '#090C12';
    g.fillRect(0, 0, this.width, this.height);

    const padBottom = this.ctx.isTouch ? 86 : 24;
    const cell = Math.floor(Math.min((this.height - padBottom - 24) / ROWS, (this.width - 210) / COLS));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const ox = Math.floor((this.width - boardW) / 2);
    const oy = Math.floor((this.height - padBottom - boardH) / 2);

    // Well background
    g.fillStyle = '#111722';
    g.fillRect(ox, oy, boardW, boardH);
    g.strokeStyle = '#2A364D';
    g.lineWidth = 2;
    g.strokeRect(ox - 1, oy - 1, boardW + 2, boardH + 2);

    // Grid lines
    g.strokeStyle = '#182030';
    g.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      g.beginPath();
      g.moveTo(ox + c * cell, oy);
      g.lineTo(ox + c * cell, oy + boardH);
      g.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      g.beginPath();
      g.moveTo(ox, oy + r * cell);
      g.lineTo(ox + boardW, oy + r * cell);
      g.stroke();
    }

    // Placed blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = this.board[r][c];
        if (col) {
          this.drawCell(ox + c * cell, oy + r * cell, cell, col, 1);
        }
      }
    }

    // Ghost piece
    const gy = this.ghostY();
    for (let r = 0; r < this.currShape.length; r++) {
      for (let c = 0; c < this.currShape[r].length; c++) {
        if (!this.currShape[r][c]) continue;
        this.drawCell(ox + (this.currX + c) * cell, oy + (gy + r) * cell, cell, this.currColor, 0.2);
      }
    }

    // Active piece
    for (let r = 0; r < this.currShape.length; r++) {
      for (let c = 0; c < this.currShape[r].length; c++) {
        if (!this.currShape[r][c]) continue;
        this.drawCell(ox + (this.currX + c) * cell, oy + (this.currY + r) * cell, cell, this.currColor, 1);
      }
    }

    // Line clear flash
    if (this.flashTimer > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flashTimer / 0.16})`;
      for (const r of this.flashRows) {
        g.fillRect(ox, oy + r * cell, boardW, cell);
      }
    }

    // Side previews: NEXT & HOLD (when horizontal room allows)
    if (ox > 96) {
      this.drawMiniBox(ox + boardW + 16, oy, 'SIGUIENTE', this.nextIndex, cell * 0.72);
      this.drawMiniBox(ox - 102, oy, 'HOLD [C]', this.holdIndex, cell * 0.72);
    }
  }

  private drawCell(x: number, y: number, size: number, color: string, alpha: number): void {
    const g = this.g;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(x + 1, y + 1, size - 2, size - 2);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x + 2, y + 2, size - 4, 3);
    g.globalAlpha = 1;
  }

  private drawMiniBox(x: number, y: number, label: string, idx: number | null, miniCell: number): void {
    const g = this.g;
    g.fillStyle = '#111722';
    g.strokeStyle = '#252F42';
    g.lineWidth = 1;
    g.fillRect(x, y, 86, 86);
    g.strokeRect(x, y, 86, 86);

    g.fillStyle = '#9FB0C7';
    g.font = '700 10px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.fillText(label, x + 43, y + 14);

    if (idx === null) return;
    const def = TETROMINOES[idx];
    const pw = def.shape[0].length * miniCell;
    const ph = def.shape.length * miniCell;
    const sx = x + (86 - pw) / 2;
    const sy = y + 20 + (62 - ph) / 2;
    for (let r = 0; r < def.shape.length; r++) {
      for (let c = 0; c < def.shape[r].length; c++) {
        if (def.shape[r][c]) {
          this.drawCell(sx + c * miniCell, sy + r * miniCell, miniCell, def.color, 1);
        }
      }
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
    const logicPerf = Math.max(
      180,
      Math.min(1000, Math.round(230 + this.linesCleared * 48 + this.score * 0.08))
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      puzzlesSolved: this.linesCleared,
      survived: true,
      axisPerformances: {
        logic: logicPerf,
        agility: Math.round(logicPerf * 0.8),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
