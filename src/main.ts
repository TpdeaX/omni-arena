import './style.css';
import { synthAudio } from './audio/SynthAudio';
import { GameShell } from './engine/GameShell';
import { profileStore } from './state/ProfileStore';
import { GameModeId } from './types';
import { HubView } from './ui/HubView';
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

function showHub(): void {
  activeShell?.destroy();
  activeShell = null;
  currentHub?.destroy();
  currentHub = new HubView(root, launchMode);
  currentHub.render();
}

function launchMode(modeId: GameModeId, practiceMode = false): void {
  activeShell?.destroy();
  currentHub?.destroy();
  currentHub = null;
  activeShell = new GameShell(root, modeId, {
    onExitToHub: showHub,
    onReplay: launchMode,
  });
  activeShell.start({ practiceMode });
}

bindEcoThemeSync((theme) => {
  profileStore.applyExternalTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  if (currentHub) {
    currentHub.render();
  }
});

showHub();

void profileStore.syncFromCloud(false).then((res) => {
  if (res.updated) {
    const s = profileStore.get().settings;
    document.documentElement.setAttribute('data-theme', s.theme ?? 'night');
    document.documentElement.setAttribute('data-motion', s.reduceMotion ? 'reduced' : 'normal');
    synthAudio.setConfig(s.volume, s.muted);
    currentHub?.render();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
