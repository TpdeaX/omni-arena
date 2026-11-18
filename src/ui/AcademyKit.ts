export interface AcademyLayoutRefs {
  root: HTMLDivElement;
  stageEl: HTMLDivElement;
  sideEl: HTMLElement;
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
