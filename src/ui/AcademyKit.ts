import { DifficultyId } from '../types';
import { Icons } from '../icons';

export interface SectionTutorialInfo {
  id: string;
  sectionName: string;
  steps: string[];
  tip?: string;
}

const TUT_STORAGE_PREFIX = 'oa-sec-tut:';

function readTutorialOpenState(id: string): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TUT_STORAGE_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function writeTutorialOpenState(id: string, open: boolean): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(TUT_STORAGE_PREFIX + id, open ? '1' : '0');
    }
  } catch {
    // ignore storage restrictions
  }
}

export function createSectionTutorialEl(info: SectionTutorialInfo): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'oa-sec-tutorial';
  wrap.dataset.tutorialId = info.id;
  wrap.setAttribute('aria-label', `Tutorial de sección: ${info.sectionName}`);

  let isOpen = readTutorialOpenState(info.id);

  const head = document.createElement('div');
  head.className = 'oa-sec-tutorial-head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'oa-sec-tutorial-title';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'oa-sec-tutorial-icon';
  iconSpan.innerHTML = Icons.bookOpen(15);

  const titleText = document.createElement('span');
  titleText.textContent = info.sectionName;

  titleWrap.append(iconSpan, titleText);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'oa-sec-tutorial-toggle';

  const body = document.createElement('div');
  body.className = 'oa-sec-tutorial-body';

  const list = document.createElement('ol');
  list.className = 'oa-sec-tutorial-steps';
  info.steps.forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    list.appendChild(li);
  });
  body.appendChild(list);

  if (info.tip && info.tip.trim().length > 0) {
    const tipBox = document.createElement('div');
    tipBox.className = 'oa-sec-tutorial-tip';

    const tipIcon = document.createElement('span');
    tipIcon.className = 'oa-sec-tutorial-tip-icon';
    tipIcon.innerHTML = Icons.lightbulb(14);

    const tipText = document.createElement('span');
    const tipStrong = document.createElement('strong');
    tipStrong.textContent = 'Truco pro: ';
    tipText.append(tipStrong, document.createTextNode(info.tip));

    tipBox.append(tipIcon, tipText);
    body.appendChild(tipBox);
  }

  const syncState = (): void => {
    wrap.classList.toggle('is-open', isOpen);
    body.hidden = !isOpen;
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggleBtn.textContent = isOpen ? 'Ocultar tutorial' : 'Tutorial sección';
  };

  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    writeTutorialOpenState(info.id, isOpen);
    syncState();
  });

  head.append(titleWrap, toggleBtn);
  wrap.append(head, body);
  syncState();

  return wrap;
}

export interface AcademyLayoutRefs {
  root: HTMLDivElement;
  stageEl: HTMLDivElement;
  sideEl: HTMLElement;
}

const DIFF_LABELS: Record<DifficultyId, string> = {
  chill: 'CADETE',
  standard: 'ESTÁNDAR',
  hyper: 'ÉLITE',
  adaptive: 'DINÁMICA IA',
  progressive: 'PROGRESIVA',
};

export function renderDifficultyBadge(difficulty: DifficultyId, infiniteMode = false): string {
  const label = DIFF_LABELS[difficulty] ?? 'ESTÁNDAR';
  return infiniteMode ? `${label} · INFINITO` : label;
}

export function createAcademyLayout(
  container: HTMLElement,
  title: string,
  badgeText: string
): AcademyLayoutRefs {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'oa-academy-layout';

  const stageEl = document.createElement('div');
  stageEl.className = 'oa-academy-stage';

  const sideEl = document.createElement('aside');
  sideEl.className = 'oa-academy-side';
  sideEl.setAttribute('aria-label', title);

  const headerCard = document.createElement('div');
  headerCard.className = 'oa-academy-card oa-academy-head';

  const titleEl = document.createElement('h2');
  titleEl.className = 'oa-academy-title';
  titleEl.textContent = title;

  const badgeEl = document.createElement('span');
  badgeEl.className = 'oa-academy-badge';
  badgeEl.textContent = badgeText;

  headerCard.append(titleEl, badgeEl);
  sideEl.appendChild(headerCard);
  root.append(stageEl, sideEl);
  container.appendChild(root);

  return { root, stageEl, sideEl };
}

export function renderExplanationBox(
  target: HTMLElement,
  heading: string,
  bodyText: string,
  tone: 'info' | 'good' | 'warn' | 'bad' = 'info'
): void {
  target.innerHTML = '';
  target.className = `oa-explain-box oa-explain-${tone}`;

  const h = document.createElement('div');
  h.className = 'oa-explain-heading';
  h.textContent = heading;

  const p = document.createElement('p');
  p.className = 'oa-explain-body';
  p.textContent = bodyText;

  target.append(h, p);
}

export function renderLessonStepper(
  target: HTMLElement,
  lessons: { id: string; title: string }[],
  activeId: string,
  onSelect: (id: string) => void
): void {
  target.innerHTML = '';
  target.className = 'oa-academy-stepper';
  target.setAttribute('role', 'tablist');

  lessons.forEach((lesson, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oa-academy-step-btn';
    const isActive = lesson.id === activeId;
    if (isActive) btn.classList.add('is-active');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.dataset.lessonId = lesson.id;

    const numSpan = document.createElement('span');
    numSpan.className = 'oa-academy-step-num';
    numSpan.textContent = String(index + 1);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'oa-academy-step-label';
    labelSpan.textContent = lesson.title;

    btn.append(numSpan, labelSpan);
    btn.addEventListener('click', () => onSelect(lesson.id));
    target.appendChild(btn);
  });
}
