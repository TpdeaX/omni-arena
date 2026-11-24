import './style.css';
import { synthAudio } from './audio/SynthAudio';
import { GameShell } from './engine/GameShell';
import { DIAGNOSTIC_STAGES } from './state/NeuroStore';
import { profileStore } from './state/ProfileStore';
import { GameModeId, NeuroPillar, RunMetrics, StandaloneGameId } from './types';
import { HubView } from './ui/HubView';
import { NeuroLabView, showActiveMicroPause } from './ui/NeuroLabView';
import { bindEcoThemeSync } from './utils/ecosystem';

const root = document.getElementById('app')!;
const settings = profileStore.get().settings;
document.documentElement.setAttribute('data-theme', settings.theme ?? 'night');
document.documentElement.setAttribute(
  'data-motion',
  settings.reduceMotion ? 'reduced' : 'normal'
);
synthAudio.setConfig(settings.volume, settings.muted);

let activeShell: GameShell | null = null;
let currentHub: HubView | null = null;
let currentNeuroLab: NeuroLabView | null = null;
let activePauseCleanup: (() => void) | null = null;
let returnDestination: 'hub' | 'neurolab' = 'hub';

function clearActiveViews(): void {
  activePauseCleanup?.();
  activePauseCleanup = null;
  activeShell?.destroy();
  activeShell = null;
  currentHub?.destroy();
  currentHub = null;
  currentNeuroLab?.destroy();
  currentNeuroLab = null;
}

function setHashSilently(nextHash: string): void {
  if (window.location.hash === nextHash) return;
  try {
    const url = new URL(window.location.href);
    url.hash = nextHash;
    window.history.replaceState(null, '', url.toString());
  } catch {
    window.location.hash = nextHash;
  }
}

function showHub(): void {
  clearActiveViews();
  returnDestination = 'hub';
  if (window.location.hash === '#neurolab') {
    setHashSilently('');
  }
  currentHub = new HubView(root, (m, p, inf) => launchMode(m, p, inf, 'hub'), () => showNeuroLab());
  currentHub.render();
}

function showNeuroLab(notice?: string): void {
  clearActiveViews();
  returnDestination = 'neurolab';
  setHashSilently('#neurolab');
  currentNeuroLab = new NeuroLabView(root, {
    onBackToHub: showHub,
    onLaunchMode: (m, p, inf) => launchMode(m, p, inf, 'neurolab'),
    onStartDiagnostic: startDiagnosticPlaylist,
    onStartDailySession: startDailySmartPlaylist,
    onStartCourseDay: startCourseDaySession,
  });
  if (notice) currentNeuroLab.setNotice(notice);
  currentNeuroLab.render();
}

function launchMode(
  modeId: GameModeId,
  practiceMode = false,
  infiniteMode = false,
  backTo: 'hub' | 'neurolab' = returnDestination
): void {
  clearActiveViews();
  returnDestination = backTo;
  activeShell = new GameShell(root, modeId, {
    onExitToHub: () => (backTo === 'neurolab' ? showNeuroLab() : showHub()),
    onReplay: (m, p, inf) => launchMode(m, p, inf, backTo),
  });
  activeShell.start({
    practiceMode,
    infiniteMode,
    exitLabel: backTo === 'neurolab' ? 'VOLVER A NEUROLAB' : 'VOLVER AL HUB',
  });
}

function startDiagnosticPlaylist(): void {
  const results: Partial<Record<NeuroPillar, { score: number; accuracy?: number; avgReactionMs?: number }>> = {};

  const runStage = (idx: number): void => {
    if (idx >= DIAGNOSTIC_STAGES.length) {
      const updated = profileStore.saveDiagnosticBaseline(results);
      showNeuroLab(
        `Evaluación Cognitiva completada: tu NeuroScore inicial es ${updated.neuroScore}/1000 (Memoria ${updated.pillars.memory} · Atención ${updated.pillars.attention} · Velocidad ${updated.pillars.speed} · Razonamiento ${updated.pillars.reasoning}).`
      );
      return;
    }

    const stage = DIAGNOSTIC_STAGES[idx];
    clearActiveViews();
    returnDestination = 'neurolab';
    activeShell = new GameShell(root, stage.modeId, {
      onExitToHub: () => showNeuroLab('Evaluación diagnóstica pausada. Puedes retomarla cuando quieras.'),
      onReplay: () => runStage(idx),
    });
    activeShell.start({
      practiceMode: false,
      infiniteMode: false,
      durationOverrideSec: stage.durationSec,
      sessionBadge: `DIAGNÓSTICO ${idx + 1}/4`,
      exitLabel: 'SALIR A NEUROLAB',
      onSessionComplete: (metrics: RunMetrics) => {
        results[stage.pillar] = {
          score: metrics.score,
          accuracy: metrics.accuracy,
          avgReactionMs: metrics.avgReactionMs,
        };
        runStage(idx + 1);
      },
    });
  };

  runStage(0);
}

function startDailySmartPlaylist(): void {
  const neuro = profileStore.getNeuro();
  const pendingSteps = neuro.dailyPlan.steps.filter((s) => !s.completed);
  const queue = pendingSteps.length > 0 ? pendingSteps : neuro.dailyPlan.steps;
  const totalCount = queue.length;
  const pauseAfterIdx = Math.floor(totalCount / 2) - 1; // After step 2 of 4

  const runStep = (idx: number): void => {
    if (idx >= queue.length) {
      const updated = profileStore.getNeuro();
      showNeuroLab(
        `Sesión Diaria Inteligente completada. Tu NeuroScore actualizado es ${updated.neuroScore}/1000.`
      );
      return;
    }

    const step = queue[idx];
    clearActiveViews();
    returnDestination = 'neurolab';
    activeShell = new GameShell(root, step.modeId, {
      onExitToHub: () => showNeuroLab('Sesión diaria interrumpida. Los pasos completados ya quedaron guardados.'),
      onReplay: () => runStep(idx),
    });
    activeShell.start({
      practiceMode: false,
      infiniteMode: false,
      sessionBadge: `SESIÓN DIARIA ${idx + 1}/${totalCount}`,
      exitLabel: 'VOLVER A NEUROLAB',
      onSessionComplete: () => {
        const shouldPause = idx === pauseAfterIdx && idx + 1 < queue.length;
        if (shouldPause) {
          clearActiveViews();
          activePauseCleanup = showActiveMicroPause(root, () => {
            activePauseCleanup = null;
            runStep(idx + 1);
          });
        } else {
          runStep(idx + 1);
        }
      },
    });
  };

  runStep(0);
}

function startCourseDaySession(courseId: string, dayNumber: number, modeId: StandaloneGameId): void {
  clearActiveViews();
  returnDestination = 'neurolab';
  activeShell = new GameShell(root, modeId, {
    onExitToHub: () => showNeuroLab(),
    onReplay: () => startCourseDaySession(courseId, dayNumber, modeId),
  });
  activeShell.start({
    practiceMode: false,
    infiniteMode: false,
    sessionBadge: `CURSO · DÍA ${dayNumber}`,
    exitLabel: 'VOLVER A NEUROLAB',
    onSessionComplete: (metrics: RunMetrics) => {
      profileStore.completeNeuroCourseDay(courseId, dayNumber);
      showNeuroLab(
        `Día ${dayNumber} del curso completado (${metrics.score.toLocaleString('es-ES')} pts). Nivel adaptativo actualizado.`
      );
    },
  });
}

bindEcoThemeSync((theme) => {
  profileStore.applyExternalTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  if (currentHub) {
    currentHub.render();
  } else if (currentNeuroLab) {
    currentNeuroLab.render();
  }
});

window.addEventListener('hashchange', () => {
  if (activeShell) return;
  if (window.location.hash.toLowerCase() === '#neurolab') {
    if (!currentNeuroLab) showNeuroLab();
  } else if (currentNeuroLab) {
    showHub();
  }
});

if (window.location.hash.toLowerCase() === '#neurolab') {
  showNeuroLab();
} else {
  showHub();
}

void profileStore.syncFromCloud(false).then((res) => {
  if (res.updated) {
    const s = profileStore.get().settings;
    document.documentElement.setAttribute('data-theme', s.theme ?? 'night');
    document.documentElement.setAttribute('data-motion', s.reduceMotion ? 'reduced' : 'normal');
    synthAudio.setConfig(s.volume, s.muted);
    currentHub?.render();
    currentNeuroLab?.render();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
