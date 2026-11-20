import '../styles/academy-board.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { ControlHint, GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  createSectionTutorialEl,
  renderExplanationBox,
  SectionTutorialInfo,
} from '../ui/AcademyKit';
import {
  applyPokerAction,
  calculateOuts,
  Card,
  choosePokerBotAction,
  createInitialPokerPlayers,
  evaluateHand,
  getLegalPokerOptions,
  getPokerAdvice,
  HAND_GUIDE,
  PokerAction,
  PokerHandState,
  PokerPlayer,
  rankShortLabel,
  startPokerHand,
  Suit,
} from './poker/pokerEngine';

type Phase = 'prep' | 'playing';

function suitSvgPath(suit: Suit): string {
  switch (suit) {
    case 's':
      return '<path d="M25 18c-6 7-11 11-11 16a5.5 5.5 0 0 0 9.5 3.8L22 44h6l-1.5-6.2A5.5 5.5 0 0 0 36 34c0-5-5-9-11-16z"/>';
    case 'h':
      return '<path d="M25 42s-12-8.2-12-16.5A6.5 6.5 0 0 1 25 21a6.5 6.5 0 0 1 12 4.5C37 33.8 25 42 25 42z"/>';
    case 'd':
      return '<polygon points="25,17 36,30 25,43 14,30"/>';
    case 'c':
      return '<circle cx="25" cy="23" r="5.2"/><circle cx="18.5" cy="32" r="5.2"/><circle cx="31.5" cy="32" r="5.2"/><path d="M23 34l-1.5 9h7L27 34z"/>';
  }
}

function renderCardSvg(card: Card | null, size: 'md' | 'sm' | 'mini' = 'md'): string {
  const sizeCls = size === 'sm' ? ' is-sm' : size === 'mini' ? ' is-mini' : '';
  if (!card) {
    return `
      <svg class="oa-card-svg${sizeCls}" viewBox="0 0 50 70" aria-label="Carta oculta">
        <rect x="1.5" y="1.5" width="47" height="67" rx="6" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
        <rect x="6" y="6" width="38" height="58" rx="3" fill="none" stroke="#38bdf8" stroke-width="1.4" stroke-dasharray="3 2"/>
        <polygon points="25,20 35,35 25,50 15,35" fill="#0284c7" opacity="0.65"/>
      </svg>
    `;
  }

  const isRed = card.suit === 'h' || card.suit === 'd';
  const color = isRed ? '#dc2626' : '#0f172a';
  const label = rankShortLabel(card.rank);
  const fontSize = label === '10' ? '11' : '12.5';

  return `
    <svg class="oa-card-svg${sizeCls}" viewBox="0 0 50 70" aria-label="${label} de ${card.suit}">
      <rect x="1.5" y="1.5" width="47" height="67" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <text x="5.5" y="15" fill="${color}" font-family="var(--font-mono)" font-weight="800" font-size="${fontSize}">${label}</text>
      <g fill="${color}" transform="translate(0, 5)">${suitSvgPath(card.suit)}</g>
    </svg>
  `;
}

export class PokerAcademyGame implements MiniGame {
  public readonly id = 'poker2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice: boolean;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tutorialSlotEl!: HTMLDivElement;
  private sideContentEl!: HTMLDivElement;
  private guideCardEl!: HTMLDivElement;
  private explainEl!: HTMLDivElement;

  private phase: Phase = 'prep';
  private difficultyLevel: 0 | 1 | 2 = 1;
  private guideExpanded = true;
  private revealBotsAtEnd = true;

  private players: PokerPlayer[] = createInitialPokerPlayers();
  private handState!: PokerHandState;
  private handNumber = 0;
  private dealerSeat = 0;
  private maxChallengeHands = 20;

  private botTimer: number | null = null;
  private sessionEnded = false;
  private handsPlayed = 0;
  private handsWon = 0;

  private paused = false;
  private destroyed = false;
  private elapsed = 0;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    if (ctx.difficulty === 'chill') this.difficultyLevel = 0;
    else if (ctx.difficulty === 'hyper') this.difficultyLevel = 2;
    else this.difficultyLevel = 1;

    this.guideExpanded = Boolean(ctx.practiceMode);
    this.revealBotsAtEnd = Boolean(ctx.practiceMode);

    const layout = createAcademyLayout(
      ctx.container,
      'PÓKER TEXAS HOLD\'EM',
      ctx.practiceMode ? 'PRÁCTICA' : 'RETO OFICIAL'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.tutorialSlotEl = document.createElement('div');
    this.explainEl = document.createElement('div');
    this.sideContentEl = document.createElement('div');
    this.sideContentEl.className = 'oa-academy-card';
    this.guideCardEl = document.createElement('div');
    this.guideCardEl.className = 'oa-academy-card';

    this.sideEl.append(this.tutorialSlotEl, this.explainEl, this.sideContentEl, this.guideCardEl);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'PÓKER EDUCATIVO',
      accent: '#15803D',
      timeLeftSec: null,
      subStat: 'FICHAS DE PRÁCTICA · SIN DINERO REAL',
    });

    this.updateControlsBar();
    window.addEventListener('keydown', this.onKeyDown);
    this.renderPrep();
  }

  private updateControlsBar(): void {
    const hints: ControlHint[] = [
      { keys: ['1'], touch: 'Pasar / Igualar', action: 'Igualar o pasar', tone: 'primary' },
      { keys: ['2'], touch: 'Subir', action: 'Subir apuesta' },
      { keys: ['3'], touch: 'Retirarse', action: 'Abandonar mano', tone: 'danger' },
      { keys: ['G'], touch: 'Botón Guía', action: 'Ver 10 manos' },
    ];
    this.ctx.setControls?.(hints);
  }

  private clearBotTimer(): void {
    if (this.botTimer !== null) {
      window.clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private lastTutorialKey = '';

  private updateSectionTutorial(): void {
    const key = this.phase === 'prep' ? 'prep' : `street:${this.handState?.street ?? 'preflop'}`;
    if (key === this.lastTutorialKey) return;
    this.lastTutorialKey = key;

    let info: SectionTutorialInfo;
    if (this.phase === 'prep') {
      info = {
        id: 'poker:prep',
        sectionName: 'Preparar Mesa Texas Hold\'em',
        steps: [
          'Elige el nivel de exigencia de los 3 bots (Lucía prudente, Mateo equilibrado y Sofía agresiva).',
          'Cada asiento comienza con 1000 fichas de práctica y ciegas 10/20 (sin dinero real).',
          'Usa la guía de las 10 manos (G) en la columna derecha para consultar el ranking en cualquier momento.',
        ],
        tip: 'En Práctica Guiada verás tu probabilidad estimada (equity), tus outs y recomendación por pot odds.',
      };
    } else if (this.handState.street === 'preflop') {
      info = {
        id: 'poker:preflop',
        sectionName: 'Ronda Pre-Flop (2 cartas)',
        steps: [
          'Evalúa tus 2 cartas privadas: parejas altas, ases fuertes o cartas conectadas del mismo palo tienen mayor equity.',
          'Pulsa 1 para Pasar/Igualar, 2 para Subir apuesta o 3 para Retirarte sin malgastar fichas.',
          'Observa la posición del botón Repartidor (D): actuar después te da información de los rivales.',
        ],
        tip: 'Retirarse con manos débiles fuera de posición es una decisión ganadora a largo plazo.',
      };
    } else if (this.handState.street === 'showdown') {
      info = {
        id: 'poker:showdown',
        sectionName: 'Showdown (Resolución de mano)',
        steps: [
          'Se comparan las mejores combinaciones de 5 cartas usando tus 2 privadas y las 5 comunitarias.',
          'Revisa la caja de explicación para analizar por qué ganó la mano vencedora y sus kickers.',
          'Pulsa Siguiente mano para repartir una nueva ronda y rotar el botón de repartidor.',
        ],
        tip: 'Fíjate en el patrón de apuestas de cada bot para ajustar tu estrategia en las manos siguientes.',
      };
    } else {
      const streetTitle =
        this.handState.street === 'flop'
          ? 'Flop (3 comunitarias)'
          : this.handState.street === 'turn'
            ? 'Turn (4ª carta)'
            : 'River (5ª carta)';
      info = {
        id: `poker:${this.handState.street}`,
        sectionName: `Ronda ${streetTitle}`,
        steps: [
          'Combina tus 2 cartas privadas con las comunitarias del centro para evaluar tu jugada actual y proyectos.',
          'Aplica la regla del 2 y 4: multiplica tus outs por 4 en el Flop (o por 2 en el Turn) para estimar tu % de completar.',
          'Compara tu equity contra las probabilidades del bote antes de igualar una subida rival.',
        ],
        tip: 'En el River ya no quedan cartas por salir: valora solo la fuerza hecha de tu mano frente al rango rival.',
      };
    }
    this.tutorialSlotEl.replaceChildren(createSectionTutorialEl(info));
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.updateSectionTutorial();
    const isPractice = Boolean(this.ctx.practiceMode);
    const levelNames = ['Amistoso', 'Estándar', 'Exigente'];

    this.stageEl.innerHTML = '';
    const notice = document.createElement('div');
    notice.className = 'oa-poker-notice';
    notice.textContent = 'Fichas de práctica. Sin dinero real.';

    const prep = document.createElement('div');
    prep.className = 'oa-board-prep';
    prep.innerHTML = `
      <h3 class="oa-board-prep-title">Mesa Texas Hold'em educativa</h3>
      <p class="oa-board-prep-desc">${
        isPractice
          ? 'Practica frente a 3 bots con estilo distinto (Lucía prudente, Mateo equilibrado y Sofía agresiva). Incluye medidor Monte Carlo, outs, regla del 2 y 4 y consejo por probabilidades del bote.'
          : 'Reto de 20 manos (o hasta eliminar la mesa) con 1000 fichas iniciales y ciegas 10/20. Tu puntuación depende de las fichas finales.'
      }</p>

      <div class="oa-board-field">
        <span class="oa-board-field-label">Exigencia de los bots</span>
        <div class="oa-board-seg">
          ${[0, 1, 2]
            .map(
              (lvl) =>
                `<button type="button" class="oa-board-seg-btn" data-lvl="${lvl}" aria-pressed="${this.difficultyLevel === lvl}">${levelNames[lvl]}</button>`
            )
            .join('')}
        </div>
      </div>

      <button type="button" class="oa-board-primary-btn" id="oa-poker-start-btn">${Icons.play(18)}<span>Empezar mesa</span></button>
    `;

    this.stageEl.append(notice, prep);

    prep.querySelectorAll<HTMLButtonElement>('[data-lvl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.difficultyLevel = Number(btn.dataset.lvl) as 0 | 1 | 2;
        prep.querySelectorAll<HTMLButtonElement>('[data-lvl]').forEach((b) =>
          b.setAttribute('aria-pressed', String(Number(b.dataset.lvl) === this.difficultyLevel))
        );
      });
    });

    prep.querySelector('#oa-poker-start-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startSession();
    });

    renderExplanationBox(
      this.explainEl,
      'Objetivo del juego',
      'Combina tus 2 cartas privadas con las 5 comunitarias para formar la mejor mano de 5 cartas o hacer que los rivales se retiren.',
      'info'
    );
    this.sideContentEl.innerHTML = `<p style="margin:0;font-size:0.84rem;color:var(--ink-secondary);">Ciegas 10 / 20 · 1000 fichas por asiento · Sin dinero real.</p>`;
    this.renderHandsGuide(null);
  }

  private startSession(): void {
    this.phase = 'playing';
    this.players = createInitialPokerPlayers();
    this.handNumber = 0;
    this.dealerSeat = 0;
    this.sessionEnded = false;
    this.handsPlayed = 0;
    this.handsWon = 0;
    this.dealNextHand();
  }

  private dealNextHand(): void {
    this.clearBotTimer();
    const alivePlayers = this.players.filter((p) => p.chips > 0);
    const human = this.players[0];

    if (
      human.chips <= 0 ||
      alivePlayers.length <= 1 ||
      (!this.ctx.practiceMode && this.handNumber >= this.maxChallengeHands)
    ) {
      this.finishSession();
      return;
    }

    this.handNumber++;
    this.dealerSeat = (this.handNumber - 1) % 4;
    // Ensure dealer sits on an active player
    for (let i = 0; i < 4; i++) {
      const idx = (this.dealerSeat + i) % 4;
      if (this.players[idx].chips > 0) {
        this.dealerSeat = idx;
        break;
      }
    }

    this.handState = startPokerHand(this.players, this.handNumber, this.dealerSeat);
    this.players = this.handState.players;

    this.ctx.setHud({
      subStat: this.ctx.practiceMode
        ? `MANO #${this.handNumber} · PRÁCTICA`
        : `MANO ${this.handNumber}/${this.maxChallengeHands} · FICHAS ${human.chips}`,
    });

    this.renderTable();
    this.maybeScheduleBotTurn();
  }

  private maybeScheduleBotTurn(): void {
    this.clearBotTimer();
    if (this.destroyed || this.paused || this.sessionEnded) return;

    if (this.handState.street === 'showdown' || this.handState.actingSeat === null) {
      this.onHandComplete();
      return;
    }

    const acting = this.handState.players[this.handState.actingSeat];
    if (acting.isHuman) {
      this.renderTable();
      return;
    }

    this.botTimer = window.setTimeout(() => {
      this.botTimer = null;
      if (this.destroyed || this.paused || this.sessionEnded) return;
      const bias = this.difficultyLevel === 0 ? -0.05 : this.difficultyLevel === 2 ? 0.05 : 0;
      const action = choosePokerBotAction(this.handState, bias);
      this.handState = applyPokerAction(this.handState, action);
      this.players = this.handState.players;

      if (action.type === 'fold') synthAudio.uiClick();
      else if (action.type === 'raise') synthAudio.hitmarker(1);
      else synthAudio.pickup();

      this.renderTable();
      this.maybeScheduleBotTurn();
    }, 320);
  }

  private onHandComplete(): void {
    this.players = this.handState.players;
    this.handsPlayed++;
    const humanWon = this.handState.winners.some((w) => w.seat === 0);
    if (humanWon) {
      this.handsWon++;
      this.ctx.addScore(150, 1);
      synthAudio.puzzleSuccess(this.handsWon);
    }

    const human = this.players[0];
    this.ctx.setHud({
      subStat: this.ctx.practiceMode
        ? `MANO #${this.handNumber} FIN · FICHAS ${human.chips}`
        : `MANO ${this.handNumber}/${this.maxChallengeHands} · FICHAS ${human.chips}`,
    });

    this.renderTable();
  }

  private performHumanAction(action: PokerAction): void {
    if (this.paused || this.destroyed || this.sessionEnded) return;
    if (this.handState.actingSeat !== 0 || this.handState.street === 'showdown') return;

    this.handState = applyPokerAction(this.handState, action);
    this.players = this.handState.players;

    if (action.type === 'fold') synthAudio.uiClick();
    else if (action.type === 'raise') synthAudio.hitmarker(1);
    else synthAudio.pickup();

    this.renderTable();
    this.maybeScheduleBotTurn();
  }

  private finishSession(): void {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    this.clearBotTimer();

    const human = this.players[0];
    const survived = human.chips > 0;
    const finalScore = human.chips + (survived ? 500 : 0);

    renderExplanationBox(
      this.explainEl,
      survived ? 'Sesión completada' : 'Te quedaste sin fichas',
      `Finalizas con ${human.chips} fichas tras ${this.handsPlayed} manos (${this.handsWon} ganadas). Puntuación: ${finalScore}.`,
      survived ? 'good' : 'bad'
    );

    if (!this.isGauntletSlice && !this.ctx.practiceMode) {
      const logicPerf = Math.min(
        980,
        Math.max(200, Math.round(320 + human.chips * 0.16 + this.handsWon * 28))
      );
      const metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> = {
        score: finalScore,
        maxCombo: this.handsWon,
        accuracy: this.handsPlayed > 0 ? Math.round((this.handsWon / this.handsPlayed) * 100) : 50,
        hits: this.handsWon,
        misses: Math.max(0, this.handsPlayed - this.handsWon),
        puzzlesSolved: this.handsWon,
        survived,
        axisPerformances: { logic: logicPerf },
      };
      this.ctx.finish(metrics);
    } else {
      this.renderTable();
    }
  }

  // ==================== RENDERING ====================

  private renderTable(): void {
    this.updateSectionTutorial();
    const st = this.handState;
    const hero = st.players[0];
    const isShowdown = st.street === 'showdown';
    const heroCards = hero.holeCards;
    const heroEval = heroCards.length === 2 ? evaluateHand(heroCards.concat(st.community)) : null;

    this.stageEl.innerHTML = '';

    const notice = document.createElement('div');
    notice.className = 'oa-poker-notice';
    notice.textContent = 'Fichas de práctica. Sin dinero real.';

    const table = document.createElement('div');
    table.className = 'oa-poker-table';

    // 3 Bot seats
    const oppsRow = document.createElement('div');
    oppsRow.className = 'oa-poker-opponents';
    for (let i = 1; i <= 3; i++) {
      const p = st.players[i];
      const isActing = st.actingSeat === i;
      const isWinner = isShowdown && st.winners.some((w) => w.seat === i);
      const showBotCards =
        p.holeCards.length === 2 &&
        isShowdown &&
        ((!p.folded && st.players.filter((x) => !x.folded).length > 1) ||
          (this.ctx.practiceMode && this.revealBotsAtEnd));

      const seatEl = document.createElement('div');
      seatEl.className = `oa-poker-seat${isActing ? ' is-acting' : ''}${p.folded ? ' is-folded' : ''}${isWinner ? ' is-winner' : ''}`;
      seatEl.innerHTML = `
        <div class="oa-poker-seat-head">
          <span>${p.name}</span>
          ${st.dealerSeat === i ? '<span class="oa-poker-dealer-chip" title="Repartidor">D</span>' : ''}
        </div>
        <div class="oa-poker-seat-chips">Fichas: ${p.chips}</div>
        <div class="oa-poker-seat-act">${p.lastAction || (p.betThisStreet > 0 ? `Apuesta: ${p.betThisStreet}` : 'Esperando')}</div>
        <div class="oa-poker-cards-row">
          ${
            p.holeCards.length === 2
              ? showBotCards
                ? p.holeCards.map((c) => renderCardSvg(c, 'sm')).join('')
                : `${renderCardSvg(null, 'sm')}${renderCardSvg(null, 'sm')}`
              : ''
          }
        </div>
      `;
      oppsRow.appendChild(seatEl);
    }

    // Center community cards + pot
    const center = document.createElement('div');
    center.className = 'oa-poker-center';
    const streetName =
      st.street === 'preflop'
        ? 'Preflop'
        : st.street === 'flop'
          ? 'Flop'
          : st.street === 'turn'
            ? 'Turn'
            : st.street === 'river'
              ? 'River'
              : 'Showdown';

    center.innerHTML = `
      <div class="oa-poker-pot-row">
        <span>Calle: <strong>${streetName}</strong></span>
        <span class="oa-poker-pot-pill">Bote: ${st.pot}</span>
        <span>Apuesta actual: ${st.currentBet}</span>
      </div>
      <div class="oa-poker-cards-row" aria-label="Cartas comunitarias">
        ${
          st.community.length > 0
            ? st.community.map((c) => renderCardSvg(c, 'md')).join('')
            : '<span style="font-size:0.8rem;opacity:0.85;">Ronda preflop (las cartas comunitarias salen en el Flop)</span>'
        }
      </div>
    `;

    // Hero box
    const heroWinner = isShowdown && st.winners.some((w) => w.seat === 0);
    const heroBox = document.createElement('div');
    heroBox.className = `oa-poker-hero-box${st.actingSeat === 0 ? ' is-acting' : ''}${heroWinner ? ' is-winner' : ''}`;
    heroBox.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <strong>Tú</strong>
          ${st.dealerSeat === 0 ? '<span class="oa-poker-dealer-chip" title="Repartidor">D</span>' : ''}
          <span style="font-family:var(--font-mono);color:#fde68a;">Fichas: ${hero.chips}</span>
        </div>
        <div style="font-size:0.8rem;color:#cbd5e1;margin-top:4px;">
          ${heroEval ? `Tu mano actual: <strong>${heroEval.name}</strong>` : ''}
          ${hero.lastAction ? ` · ${hero.lastAction}` : ''}
        </div>
      </div>
      <div class="oa-poker-cards-row" aria-label="Tus cartas">
        ${heroCards.map((c) => renderCardSvg(c, 'md')).join('')}
      </div>
    `;

    table.append(oppsRow, center, heroBox);

    // Action buttons or Next Hand
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'oa-poker-actions-grid';

    if (isShowdown) {
      const winnerSummary = st.winners
        .map((w) => `${w.name} (+${w.amount}: ${w.handName})`)
        .join(' · ');
      const canContinue =
        hero.chips > 0 &&
        st.players.filter((p) => p.chips > 0).length > 1 &&
        (this.ctx.practiceMode || this.handNumber < this.maxChallengeHands);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'oa-board-primary-btn';
      nextBtn.style.gridColumn = '1 / -1';
      nextBtn.innerHTML = `${Icons.arrowRight(18)}<span>${
        canContinue ? 'Siguiente mano (N)' : 'Ver resultado final'
      }</span>`;
      nextBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        if (canContinue) this.dealNextHand();
        else this.finishSession();
      });

      const winBanner = document.createElement('div');
      winBanner.style.cssText =
        'grid-column:1 / -1;padding:8px 12px;border-radius:8px;background:var(--bg-panel);border:1px solid var(--accent-gold);font-size:0.86rem;font-weight:700;text-align:center;';
      winBanner.textContent = winnerSummary || 'Mano finalizada';

      actionsWrap.append(winBanner, nextBtn);
    } else {
      const isMyTurn = st.actingSeat === 0;
      const opts = isMyTurn ? getLegalPokerOptions(st) : null;

      const checkDisabled = !isMyTurn || !opts?.canCheck;
      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'oa-poker-act-btn is-primary';
      checkBtn.disabled = checkDisabled;
      checkBtn.title = !isMyTurn
        ? 'Espera tu turno'
        : opts?.canCheck
          ? 'Pasar sin apostar fichas'
          : `No puedes pasar: hay que igualar ${opts?.callAmount ?? 0} fichas`;
      checkBtn.innerHTML = `
        <span class="oa-poker-act-title">Pasar</span>
        <span class="oa-poker-act-sub">${
          opts?.canCheck
            ? 'No apostar; pasa el turno si nadie subió'
            : isMyTurn
              ? `No disponible: debes igualar ${opts?.callAmount ?? 0}`
              : 'Esperando turno…'
        }</span>
      `;
      checkBtn.addEventListener('click', () => this.performHumanAction({ type: 'check' }));

      const callDisabled = !isMyTurn || !opts?.canCall;
      const callBtn = document.createElement('button');
      callBtn.type = 'button';
      callBtn.className = 'oa-poker-act-btn is-primary';
      callBtn.disabled = callDisabled;
      callBtn.title = !isMyTurn
        ? 'Espera tu turno'
        : opts?.canCall
          ? `Pagar ${opts.callAmount} fichas para continuar`
          : 'No hay apuesta que igualar';
      callBtn.innerHTML = `
        <span class="oa-poker-act-title">Igualar ${opts?.canCall ? opts.callAmount : ''}</span>
        <span class="oa-poker-act-sub">${
          opts?.canCall
            ? `Pagar ${opts.callAmount} fichas para seguir en la mano`
            : 'Disponible cuando otro jugador apuesta o sube'
        }</span>
      `;
      callBtn.addEventListener('click', () => this.performHumanAction({ type: 'call' }));

      const foldBtn = document.createElement('button');
      foldBtn.type = 'button';
      foldBtn.className = 'oa-poker-act-btn is-danger';
      foldBtn.disabled = !isMyTurn;
      foldBtn.title = 'Retirarse de la mano actual';
      foldBtn.innerHTML = `
        <span class="oa-poker-act-title">Retirarse</span>
        <span class="oa-poker-act-sub">Abandonar la mano y no arriesgar más fichas</span>
      `;
      foldBtn.addEventListener('click', () => this.performHumanAction({ type: 'fold' }));

      const raiseInfoBtn = document.createElement('div');
      raiseInfoBtn.className = 'oa-poker-act-btn';
      raiseInfoBtn.style.cursor = 'default';
      raiseInfoBtn.innerHTML = `
        <span class="oa-poker-act-title">Subir apuesta</span>
        <span class="oa-poker-act-sub">Elige un tamaño abajo para presionar o extraer valor</span>
      `;

      actionsWrap.append(checkBtn, callBtn, raiseInfoBtn, foldBtn);

      // Raise presets
      const presetsRow = document.createElement('div');
      presetsRow.className = 'oa-poker-raise-presets';
      const canRaise = Boolean(isMyTurn && opts?.canRaise);
      const minTo = opts?.minRaiseTo ?? 20;
      const maxTo = opts?.maxRaiseTo ?? hero.chips;
      const halfPotTo = Math.min(maxTo, Math.max(minTo, st.currentBet + Math.round(st.pot * 0.5)));
      const fullPotTo = Math.min(maxTo, Math.max(minTo, st.currentBet + st.pot));

      const presets: { label: string; amount: number }[] = [
        { label: `Mínimo (${minTo})`, amount: minTo },
        { label: `1/2 bote (${halfPotTo})`, amount: halfPotTo },
        { label: `Bote (${fullPotTo})`, amount: fullPotTo },
        { label: `Todo (${maxTo})`, amount: maxTo },
      ];

      for (const p of presets) {
        const pBtn = document.createElement('button');
        pBtn.type = 'button';
        pBtn.className = 'oa-poker-preset-btn';
        pBtn.disabled = !canRaise;
        pBtn.textContent = p.label;
        pBtn.title = canRaise
          ? `Subir la apuesta total de esta calle a ${p.amount}`
          : 'Subida no disponible en este turno';
        pBtn.addEventListener('click', () =>
          this.performHumanAction({ type: 'raise', raiseTo: p.amount })
        );
        presetsRow.appendChild(pBtn);
      }

      actionsWrap.appendChild(presetsRow);
    }

    this.stageEl.append(notice, table, actionsWrap);
    this.renderSideCoaching(heroEval ? heroEval.category : null);
  }

  private renderSideCoaching(currentCategory: number | null): void {
    const st = this.handState;
    const hero = st.players[0];
    const isPractice = Boolean(this.ctx.practiceMode);

    if (st.street === 'showdown') {
      const winnerSummary = st.winners
        .map((w) => `${w.name} gana ${w.amount} con ${w.handName}`)
        .join('. ');
      renderExplanationBox(
        this.explainEl,
        'Resumen de la mano',
        winnerSummary || 'Mano terminada.',
        st.winners.some((w) => w.seat === 0) ? 'good' : 'info'
      );
    } else if (isPractice && hero.holeCards.length === 2 && !hero.folded) {
      const advice = getPokerAdvice(st, 600);
      const outs = calculateOuts(hero.holeCards, st.community);

      renderExplanationBox(
        this.explainEl,
        `Consejo (${advice.recommendedAction}) · Fuerza ~${advice.equityPct}%`,
        `${advice.explanation} ${st.community.length >= 3 && st.community.length < 5 ? outs.summary : ''}`,
        advice.recommendedAction === 'Retirarse' ? 'warn' : 'info'
      );

      this.sideContentEl.innerHTML = `
        <div class="oa-board-meta-row">
          <span>Probabilidad estimada (Monte Carlo)</span>
          <strong>${advice.equityPct}%</strong>
        </div>
        <div class="oa-equity-meter" role="progressbar" aria-valuenow="${advice.equityPct}" aria-valuemin="0" aria-valuemax="100">
          <div class="oa-equity-fill" style="width:${advice.equityPct}%"></div>
        </div>
        ${
          st.community.length >= 3 && st.community.length < 5 && outs.cards.length > 0
            ? `<div style="display:flex;flex-direction:column;gap:4px;">
                 <span style="font-size:0.78rem;color:var(--ink-secondary);font-weight:600;">Outs (${outs.totalOuts}) · Regla del ${st.community.length === 3 ? 4 : 2}: ~${outs.rule24Pct}%</span>
                 <div class="oa-poker-cards-row" style="justify-content:flex-start;">
                   ${outs.cards.slice(0, 9).map((c) => renderCardSvg(c, 'mini')).join('')}
                   ${outs.cards.length > 9 ? `<span style="font-size:0.76rem;color:var(--ink-secondary);">+${outs.cards.length - 9}</span>` : ''}
                 </div>
               </div>`
            : ''
        }
        <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--ink-secondary);cursor:pointer;">
          <input type="checkbox" id="oa-poker-reveal-chk" ${this.revealBotsAtEnd ? 'checked' : ''} />
          <span>Mostrar cartas de los bots al final</span>
        </label>
        <div class="oa-moves-log" aria-label="Registro de la mano">
          ${st.log.slice(-6).join(' · ')}
        </div>
      `;

      this.sideContentEl
        .querySelector<HTMLInputElement>('#oa-poker-reveal-chk')
        ?.addEventListener('change', (e) => {
          this.revealBotsAtEnd = (e.target as HTMLInputElement).checked;
        });
    } else {
      renderExplanationBox(
        this.explainEl,
        'Mesa en curso (Reto)',
        `Mano ${this.handNumber} de ${this.maxChallengeHands}. Evalúa el bote (${st.pot}) y la agresividad de cada rival.`,
        'info'
      );
      this.sideContentEl.innerHTML = `
        <div class="oa-board-meta-row">
          <span>Progreso</span>
          <strong>Mano ${this.handNumber}/${this.maxChallengeHands}</strong>
        </div>
        <div class="oa-moves-log" aria-label="Registro de la mano">
          ${st.log.slice(-6).join(' · ')}
        </div>
      `;
    }

    this.renderHandsGuide(currentCategory);
  }

  private renderHandsGuide(currentCategory: number | null): void {
    this.guideCardEl.innerHTML = `
      <div class="oa-board-meta-row">
        <strong style="font-family:var(--font-display);font-size:0.9rem;">Guía de las 10 manos</strong>
        <button type="button" class="oa-academy-btn" id="oa-poker-toggle-guide" aria-expanded="${this.guideExpanded}">
          ${Icons.eye(15)}<span>${this.guideExpanded ? 'Ocultar' : 'Mostrar'}</span>
        </button>
      </div>
      ${
        this.guideExpanded
          ? `<div class="oa-poker-guide-list">
              ${HAND_GUIDE.map((entry) => {
                const isCurrent = currentCategory === entry.category;
                return `
                  <div class="oa-poker-guide-item${isCurrent ? ' is-current-hand' : ''}">
                    <div class="oa-poker-guide-top">
                      <span class="oa-poker-guide-name">${10 - entry.category}. ${entry.name}</span>
                      ${isCurrent ? '<span class="oa-poker-guide-badge">TU MANO</span>' : ''}
                    </div>
                    <p class="oa-poker-guide-desc">${entry.description}</p>
                    <div class="oa-poker-guide-cards">
                      ${entry.exampleCards.map((c) => renderCardSvg(c, 'mini')).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
          : '<p style="margin:0;font-size:0.78rem;color:var(--ink-secondary);">Pulsa Mostrar (G) para consultar la jerarquía visual de manos en cualquier momento.</p>'
      }
    `;

    this.guideCardEl.querySelector('#oa-poker-toggle-guide')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.guideExpanded = !this.guideExpanded;
      const hero = this.handState?.players[0];
      const cat =
        this.phase === 'playing' && hero?.holeCards.length === 2
          ? evaluateHand(hero.holeCards.concat(this.handState.community)).category
          : null;
      this.renderHandsGuide(cat);
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || this.phase === 'prep') return;
    if (e.code === 'Escape' || e.key === '?') return;

    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (e.code === 'KeyG') {
      e.preventDefault();
      this.guideExpanded = !this.guideExpanded;
      const hero = this.handState?.players[0];
      const cat =
        hero?.holeCards.length === 2
          ? evaluateHand(hero.holeCards.concat(this.handState.community)).category
          : null;
      this.renderHandsGuide(cat);
      return;
    }

    if (this.handState.street === 'showdown') {
      if (e.code === 'KeyN') {
        e.preventDefault();
        const hero = this.players[0];
        const canContinue =
          hero.chips > 0 &&
          this.players.filter((p) => p.chips > 0).length > 1 &&
          (this.ctx.practiceMode || this.handNumber < this.maxChallengeHands);
        if (canContinue) this.dealNextHand();
        else this.finishSession();
      }
      return;
    }

    if (this.handState.actingSeat !== 0) return;
    const opts = getLegalPokerOptions(this.handState);

    if (e.code === 'Digit1') {
      e.preventDefault();
      if (opts.canCheck) this.performHumanAction({ type: 'check' });
      else if (opts.canCall) this.performHumanAction({ type: 'call' });
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      if (opts.canRaise) this.performHumanAction({ type: 'raise', raiseTo: opts.minRaiseTo });
    } else if (e.code === 'Digit3') {
      e.preventDefault();
      this.performHumanAction({ type: 'fold' });
    }
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearBotTimer();
    } else if (
      !this.destroyed &&
      this.phase === 'playing' &&
      !this.sessionEnded &&
      this.handState.street !== 'showdown' &&
      this.handState.actingSeat !== null &&
      !this.handState.players[this.handState.actingSeat]?.isHuman
    ) {
      this.maybeScheduleBotTurn();
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const chips = this.players[0]?.chips ?? 1000;
    return {
      score: chips + (chips > 0 ? 500 : 0),
      maxCombo: this.handsWon,
      accuracy: this.handsPlayed > 0 ? Math.round((this.handsWon / this.handsPlayed) * 100) : 70,
      hits: this.handsWon,
      misses: Math.max(0, this.handsPlayed - this.handsWon),
      puzzlesSolved: this.handsWon,
      survived: chips > 0,
      axisPerformances: {
        logic: Math.min(960, 350 + Math.round(chips * 0.16) + this.handsWon * 25),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearBotTimer();
    window.removeEventListener('keydown', this.onKeyDown);
    this.stageEl?.closest('.oa-academy-layout')?.remove();
  }
}
