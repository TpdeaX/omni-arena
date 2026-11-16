import './style.css';
import { synthAudio } from './audio/SynthAudio';
import { GameShell } from './engine/GameShell';
import { profileStore } from './state/ProfileStore';
import { GameModeId } from './types';
import { HubView } from './ui/HubView';

const root = document.getElementById('app')!;
const settings = profileStore.get().settings;
synthAudio.setConfig(settings.volume, settings.muted);

let activeShell: GameShell | null = null;

function showHub(): void {
  activeShell?.destroy();
  activeShell = null;
  const hub = new HubView(root, launchMode);
  hub.render();
}

function launchMode(modeId: GameModeId): void {
  activeShell?.destroy();
  activeShell = new GameShell(root, modeId, {
    onExitToHub: showHub,
    onReplay: launchMode,
  });
  activeShell.start();
}

showHub();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
