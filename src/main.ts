import './style.css';
import { synthAudio } from './audio/SynthAudio';
import { GameShell } from './engine/GameShell';
import { profileStore } from './state/ProfileStore';
import { GameModeId } from './types';
import { HubView } from './ui/HubView';

const root = document.getElementById('app')!;
const settings = profileStore.get().settings;
document.documentElement.setAttribute('data-theme', settings.theme ?? 'night');
synthAudio.setConfig(settings.volume, settings.muted);

let activeShell: GameShell | null = null;
let currentHub: HubView | null = null;

function showHub(): void {
  activeShell?.destroy();
  activeShell = null;
  currentHub = new HubView(root, launchMode);
  currentHub.render();
}

function launchMode(modeId: GameModeId): void {
  activeShell?.destroy();
  currentHub = null;
  activeShell = new GameShell(root, modeId, {
    onExitToHub: showHub,
    onReplay: launchMode,
  });
  activeShell.start();
}

showHub();

void profileStore.syncFromCloud(false).then((res) => {
  if (res.updated && currentHub) {
    const s = profileStore.get().settings;
    synthAudio.setConfig(s.volume, s.muted);
    currentHub.render();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
