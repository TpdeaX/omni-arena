// Crisp single-weight SVG icons (no emoji icons anywhere in UI)

const svgWrap = (inner: string, size = 20, cls = ''): string =>
  `<svg class="oa-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const Icons = {
  crosshair: (s = 20) =>
    svgWrap(
      '<circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
      s
    ),
  cube3d: (s = 20) =>
    svgWrap(
      '<path d="M12 2L20 6.5V17.5L12 22L4 17.5V6.5L12 2Z"/><path d="M12 22V12"/><path d="M20 6.5L12 12L4 6.5"/>',
      s
    ),
  music: (s = 20) =>
    svgWrap(
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      s
    ),
  bolt: (s = 20) =>
    svgWrap('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', s),
  puzzle: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      s
    ),
  twinStick: (s = 20) =>
    svgWrap(
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M7 12h10"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
      s
    ),
  omni: (s = 22) =>
    svgWrap(
      '<polygon points="12 2 19 6 22 12 19 18 12 22 5 18 2 12 5 6 12 2"/><circle cx="12" cy="12" r="4"/>',
      s
    ),
  trophy: (s = 18) =>
    svgWrap(
      '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
      s
    ),
  sliders: (s = 18) =>
    svgWrap(
      '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/>',
      s
    ),
  volumeOn: (s = 18) =>
    svgWrap(
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
      s
    ),
  volumeOff: (s = 18) =>
    svgWrap(
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
      s
    ),
  pause: (s = 18) =>
    svgWrap('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>', s),
  play: (s = 18) => svgWrap('<polygon points="6 3 20 12 6 21 6 3"/>', s),
  shield: (s = 16) =>
    svgWrap('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', s),
  arrowLeft: (s = 18) =>
    svgWrap('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>', s),
  arrowRight: (s = 18) =>
    svgWrap('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>', s),
  arrowUp: (s = 18) =>
    svgWrap('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>', s),
  arrowDown: (s = 18) =>
    svgWrap('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>', s),
  refresh: (s = 18) =>
    svgWrap(
      '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
      s
    ),
  check: (s = 16) => svgWrap('<polyline points="20 6 9 17 4 12"/>', s),
  flame: (s = 18) =>
    svgWrap(
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
      s
    ),
  paddle3d: (s = 20) =>
    svgWrap(
      '<rect x="3" y="17" width="18" height="3" rx="1.5"/><circle cx="12" cy="11" r="2.5"/><rect x="4" y="4" width="4" height="3" rx="0.5"/><rect x="10" y="4" width="4" height="3" rx="0.5"/><rect x="16" y="4" width="4" height="3" rx="0.5"/>',
      s
    ),
  parkour: (s = 20) =>
    svgWrap(
      '<path d="M4 18h5v-4h5v-4h6"/><circle cx="8" cy="8" r="2"/><path d="M12 6l3 2"/>',
      s
    ),
  parry: (s = 20) =>
    svgWrap(
      '<path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/>',
      s
    ),
  blocks: (s = 20) =>
    svgWrap(
      '<rect x="4" y="13" width="5" height="5" rx="0.5"/><rect x="9" y="13" width="5" height="5" rx="0.5"/><rect x="14" y="13" width="5" height="5" rx="0.5"/><rect x="9" y="8" width="5" height="5" rx="0.5"/>',
      s
    ),
  cloud: (s = 16) =>
    svgWrap('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>', s),
  sun: (s = 18) =>
    svgWrap(
      '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
      s
    ),
  moon: (s = 18) =>
    svgWrap('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', s),
  download: (s = 16) =>
    svgWrap(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      s
    ),
  upload: (s = 16) =>
    svgWrap(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
      s
    ),
  plane3d: (s = 20) =>
    svgWrap('<path d="M2 12l20-7-7 20-3-9-10-4z"/>', s),
  gridMem: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1" fill="currentColor"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="17" y="10" width="4" height="5" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/><rect x="10" y="17" width="5" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1" fill="currentColor"/>',
      s
    ),
  snake: (s = 20) =>
    svgWrap(
      '<path d="M4 17h5a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3h4"/><circle cx="19" cy="7" r="1.5" fill="currentColor"/>',
      s
    ),
  target2d: (s = 20) =>
    svgWrap(
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
      s
    ),
  laserTrack: (s = 20) =>
    svgWrap(
      '<path d="M4 17c3-7 5-10 8-10s5 3 8-4"/><circle cx="12" cy="7" r="3"/><circle cx="12" cy="7" r="1" fill="currentColor"/>',
      s
    ),
  schulte: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>',
      s
    ),
  brainNBack: (s = 20) =>
    svgWrap(
      '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c0 .7.2 1.3.5 1.9A3.5 3.5 0 0 0 5 12.5c0 1.4.8 2.6 2 3.2V19a2 2 0 0 0 2 2h1V4h-.5z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5c0 .7-.2 1.3-.5 1.9A3.5 3.5 0 0 1 19 12.5c0 1.4-.8 2.6-2 3.2V19a2 2 0 0 1-2 2h-1V4h.5z"/>',
      s
    ),
  sonicRing: (s = 20) =>
    svgWrap(
      '<circle cx="12" cy="12" r="9" stroke-dasharray="38 18"/><line x1="12" y1="12" x2="17" y2="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
      s
    ),
  close: (s = 16) =>
    svgWrap('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s),
  closeX: (s = 16) =>
    svgWrap('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s),
  // --- Academias Estrategia / 3D / Música / IQ ---
  chess: (s = 20) =>
    svgWrap(
      '<path d="M8 19h8"/><path d="M7 22h10"/><path d="M9 19l1-7H8l1-4a3 3 0 0 1 6 0l1 4h-2l1 7"/><circle cx="12" cy="4" r="1.5"/>',
      s
    ),
  checkers: (s = 20) =>
    svgWrap(
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><path d="M8.5 12h7"/>',
      s
    ),
  cards: (s = 20) =>
    svgWrap(
      '<rect x="7" y="4" width="11" height="16" rx="2"/><path d="M4 8v10a2 2 0 0 0 2 2h8"/><path d="M12.5 9l2.2 3-2.2 3-2.2-3 2.2-3z"/>',
      s
    ),
  rubik: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
      s
    ),
  piano: (s = 20) =>
    svgWrap(
      '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/><rect x="7.5" y="5" width="3" height="8" fill="currentColor"/><rect x="13.5" y="5" width="3" height="8" fill="currentColor"/>',
      s
    ),
  drums: (s = 20) =>
    svgWrap(
      '<ellipse cx="12" cy="11" rx="8" ry="3.5"/><path d="M4 11v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5"/><line x1="5" y1="4" x2="11" y2="10"/><line x1="19" y1="4" x2="13" y2="10"/>',
      s
    ),
  guitar: (s = 20) =>
    svgWrap(
      '<path d="M15 4l5 5-2 2-5-5 2-2z"/><line x1="14" y1="8" x2="9" y2="13"/><circle cx="7.5" cy="16.5" r="4.5"/><circle cx="7.5" cy="16.5" r="1.5"/>',
      s
    ),
  band: (s = 20) =>
    svgWrap(
      '<rect x="3" y="6" width="3" height="12" rx="1"/><rect x="8" y="8" width="3" height="10" rx="1"/><rect x="13" y="9" width="3" height="9" rx="1"/><rect x="18" y="10" width="3" height="8" rx="1"/><line x1="2" y1="14" x2="22" y2="14"/>',
      s
    ),
  matrix: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><path d="M18.5 16.5v4"/><path d="M16.5 18.5h4"/>',
      s
    ),
  sudoku: (s = 20) =>
    svgWrap(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><path d="M5 7h2"/><path d="M17 13h2"/><path d="M11 19h2"/>',
      s
    ),
  hanoi: (s = 20) =>
    svgWrap(
      '<line x1="3" y1="20" x2="21" y2="20"/><line x1="6" y1="7" x2="6" y2="20"/><line x1="12" y1="7" x2="12" y2="20"/><line x1="18" y1="7" x2="18" y2="20"/><rect x="4" y="16" width="4" height="2" rx="0.5"/><rect x="9" y="13" width="6" height="2" rx="0.5"/><rect x="8" y="16" width="8" height="2" rx="0.5"/>',
      s
    ),
  spatial3d: (s = 20) =>
    svgWrap(
      '<path d="M12 3l6 3.5v7L12 17l-6-3.5v-7L12 3z"/><path d="M12 10l6-3.5"/><path d="M12 10v7"/><path d="M12 10L6 6.5"/><path d="M17 19c1.8-1 3-2.5 3.5-4.5"/><polyline points="19 20.5 17 19 18.5 17"/>',
      s
    ),
  nonogram: (s = 20) =>
    svgWrap(
      '<rect x="6" y="6" width="14" height="14" rx="1.5"/><line x1="13" y1="6" x2="13" y2="20"/><line x1="6" y1="13" x2="20" y2="13"/><rect x="7.5" y="7.5" width="4" height="4" fill="currentColor"/><rect x="14.5" y="14.5" width="4" height="4" fill="currentColor"/><path d="M3 9h1.5"/><path d="M3 16h1.5"/><path d="M9 3v1.5"/><path d="M16 3v1.5"/>',
      s
    ),
  logicseq: (s = 20) =>
    svgWrap(
      '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="18" cy="17" r="3"/><line x1="8.7" y1="10.8" x2="15.3" y2="8.2"/><line x1="8.7" y1="13.2" x2="15.3" y2="15.8"/>',
      s
    ),
  memorypath: (s = 20) =>
    svgWrap(
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="8" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6.5l7 1"/><path d="M16.5 10l-7 6"/><path d="M10.5 18h5"/>',
      s
    ),
  infinity: (s = 18) =>
    svgWrap(
      '<path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>',
      s
    ),
  // --- UI / Guía / Ecosistema ---
  help: (s = 18) =>
    svgWrap(
      '<circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      s
    ),
  search: (s = 18) =>
    svgWrap('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', s),
  lightbulb: (s = 18) =>
    svgWrap(
      '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
      s
    ),
  undo: (s = 18) =>
    svgWrap(
      '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
      s
    ),
  eye: (s = 18) =>
    svgWrap(
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
      s
    ),
  rotateCw: (s = 18) =>
    svgWrap(
      '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
      s
    ),
  rotateCcw: (s = 18) =>
    svgWrap(
      '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
      s
    ),
  bookOpen: (s = 18) =>
    svgWrap(
      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
      s
    ),
  graduation: (s = 18) =>
    svgWrap(
      '<polygon points="22 10 12 5 2 10 12 15 22 10"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
      s
    ),
};
