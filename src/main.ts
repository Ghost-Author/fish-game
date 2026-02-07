import './style.css';
import { Renderer } from './game/renderer';
import { AudioManager } from './game/audio';
import { LocalGame } from './game/local-game';
import { OnlineGame } from './game/online-game';
import { setupControls } from './game/controls';
import { getSkin, skins } from './game/skins';
import { Hud } from './ui/hud';
import { loadAchievements, saveAchievements } from './game/achievements';
import { createDailyQuests } from './game/quests';
import { NetClient } from './net/client';
import type { LeaderboardEntry } from '../shared/protocol';
import { WORLD } from '../shared/constants';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const achievementsBtn = document.getElementById('achievements-btn') as HTMLButtonElement;
const settingsDrawer = document.getElementById('settings') as HTMLDivElement;
const achievementsDrawer = document.getElementById('achievements') as HTMLDivElement;
const closeSettings = document.getElementById('close-settings') as HTMLButtonElement;
const closeAchievements = document.getElementById('close-achievements') as HTMLButtonElement;
const musicToggle = document.getElementById('music-toggle') as HTMLInputElement;
const sfxToggle = document.getElementById('sfx-toggle') as HTMLInputElement;
const musicVolume = document.getElementById('music-volume') as HTMLInputElement;
const sfxVolume = document.getElementById('sfx-volume') as HTMLInputElement;
const skinSelect = document.getElementById('skin-select') as HTMLSelectElement;
const joystickEl = document.getElementById('joystick') as HTMLDivElement;
const joystickStick = document.getElementById('joystick-stick') as HTMLDivElement;
const tabs = Array.from(document.querySelectorAll('.tab')) as HTMLButtonElement[];
const tabPanels = {
  single: document.getElementById('tab-single') as HTMLDivElement,
  online: document.getElementById('tab-online') as HTMLDivElement
};
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const roomInput = document.getElementById('room-input') as HTMLInputElement;
const createRoomBtn = document.getElementById('create-room-btn') as HTMLButtonElement;
const joinRoomBtn = document.getElementById('join-room-btn') as HTMLButtonElement;

const hud = new Hud();
const audio = new AudioManager();
const renderer = new Renderer(canvas);
const input = setupControls(canvas, joystickEl, joystickStick);

const resizeCanvas = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
};
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const settingsKey = 'fish.settings';
const leaderboardKey = 'fish.leaderboard';

let achievements = loadAchievements();
let quests = createDailyQuests();
let lastScoreValue = 0;

const defaultSettings = {
  musicOn: true,
  sfxOn: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  skinId: skins[0].id
};

const loadSettings = () => {
  const raw = localStorage.getItem(settingsKey);
  if (!raw) return { ...defaultSettings };
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
};

const saveSettings = (settings: typeof defaultSettings) => {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
};

let settings = loadSettings();

const localGame = new LocalGame(canvas, {
  renderer,
  skin: getSkin(settings.skinId),
  audio,
  achievements,
  quests,
  onEvents: {
    onScore: (score, size, level) => {
      lastScoreValue = score;
      hud.updateScore(score, size, level);
      const active = quests.find((q) => !q.done) ?? quests[0];
      if (active) hud.updateQuest(active);
    },
    onQuest: (quest) => {
      hud.toast(`任务完成：${quest.title}`);
    },
    onAchievement: (achievement) => {
      hud.toast(`解锁成就：${achievement.title}`);
      saveAchievements(achievements);
      hud.renderAchievements(achievements);
    },
    onGameOver: () => {
      hud.toast('游戏结束');
      hud.showOverlay(true);
      updateLocalLeaderboard('单人玩家', lastScoreValue);
    }
  }
});

const onlineGame = new OnlineGame(canvas, renderer, getSkin(settings.skinId));

const net = new NetClient('ws://localhost:5175', {
  onState: (msg) => {
    onlineGame.updateState({
      you: msg.you,
      players: msg.players,
      fishes: msg.fishes,
      items: msg.items,
      tick: msg.tick,
      level: msg.level,
      score: msg.score
    });
    if (msg.you) hud.updateScore(msg.score, msg.you.radius / 26, msg.level);
  },
  onRoom: (msg) => {
    if (msg.type === 'roomCreated') {
      hud.setRoomStatus(`房间已创建：${msg.roomCode}`);
    }
    if (msg.type === 'roomJoined') {
      hud.setRoomStatus(`已加入房间：${msg.roomCode}`);
      hud.showOverlay(false);
      startOnlineInputLoop();
    }
    if (msg.type === 'roomLeft') {
      hud.setRoomStatus('已离开房间');
    }
  },
  onGameOver: () => {
    hud.toast('你被吃掉了');
    renderer.shake(10);
    onlineGame.stop();
    hud.showOverlay(true);
  },
  onWelcome: () => {
    hud.setRoomStatus('连接成功');
  },
  onLeaderboard: (msg) => {
    hud.renderLeaderboard(msg.entries);
  }
});

const updateLocalLeaderboard = (name: string, score: number) => {
  const raw = localStorage.getItem(leaderboardKey);
  let list: LeaderboardEntry[] = [];
  if (raw) {
    try {
      list = JSON.parse(raw) as LeaderboardEntry[];
    } catch {
      list = [];
    }
  }
  list.push({ name, score, date: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 10);
  localStorage.setItem(leaderboardKey, JSON.stringify(list));
  hud.renderLeaderboard(list);
};


const renderLocalLeaderboard = () => {
  const raw = localStorage.getItem(leaderboardKey);
  if (!raw) return hud.renderLeaderboard([]);
  try {
    const list = JSON.parse(raw) as LeaderboardEntry[];
    hud.renderLeaderboard(list);
  } catch {
    hud.renderLeaderboard([]);
  }
};

let mode: 'local' | 'online' = 'local';
let inputTimer: number | undefined;

const startOnlineInputLoop = () => {
  if (inputTimer) window.clearInterval(inputTimer);
  inputTimer = window.setInterval(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleX = WORLD.baseWidth / (rect.width * dpr);
    const scaleY = WORLD.baseHeight / (rect.height * dpr);
    net.send({
      type: 'input',
      target: { x: input.target.x * scaleX, y: input.target.y * scaleY }
    });
  }, 50);
};

const applySettings = () => {
  musicToggle.checked = settings.musicOn;
  sfxToggle.checked = settings.sfxOn;
  musicVolume.value = settings.musicVolume.toString();
  sfxVolume.value = settings.sfxVolume.toString();
  skinSelect.value = settings.skinId;
  audio.setMusic(settings.musicOn);
  audio.setSfx(settings.sfxOn);
  audio.setMusicVolume(settings.musicVolume);
  audio.setSfxVolume(settings.sfxVolume);
  localGame.setSkin(getSkin(settings.skinId));
  onlineGame.setSkin(getSkin(settings.skinId));
};

applySettings();

startBtn.addEventListener('click', () => {
  mode = 'local';
  net.disconnect();
  onlineGame.stop();
  hud.showOverlay(false);
  quests = createDailyQuests();
  localGame.setQuests(quests);
  localGame.reset();
  localGame.start();
  renderLocalLeaderboard();
  hud.renderAchievements(achievements);
});

restartBtn.addEventListener('click', () => {
  mode = 'local';
  net.disconnect();
  onlineGame.stop();
  quests = createDailyQuests();
  localGame.setQuests(quests);
  localGame.reset();
  localGame.start();
  hud.showOverlay(false);
});

pauseBtn.addEventListener('click', () => {
  if (mode === 'local') {
    localGame.stop();
    hud.showOverlay(true);
  }
});

settingsBtn.addEventListener('click', () => {
  settingsDrawer.classList.add('visible');
});

achievementsBtn.addEventListener('click', () => {
  achievementsDrawer.classList.add('visible');
  hud.renderAchievements(achievements);
  renderLocalLeaderboard();
});

closeSettings.addEventListener('click', () => {
  settingsDrawer.classList.remove('visible');
});

closeAchievements.addEventListener('click', () => {
  achievementsDrawer.classList.remove('visible');
});

musicToggle.addEventListener('change', () => {
  settings.musicOn = musicToggle.checked;
  audio.setMusic(settings.musicOn);
  saveSettings(settings);
});

sfxToggle.addEventListener('change', () => {
  settings.sfxOn = sfxToggle.checked;
  audio.setSfx(settings.sfxOn);
  saveSettings(settings);
});

musicVolume.addEventListener('input', () => {
  settings.musicVolume = Number(musicVolume.value);
  audio.setMusicVolume(settings.musicVolume);
  saveSettings(settings);
});

sfxVolume.addEventListener('input', () => {
  settings.sfxVolume = Number(sfxVolume.value);
  audio.setSfxVolume(settings.sfxVolume);
  saveSettings(settings);
});

skinSelect.addEventListener('change', () => {
  settings.skinId = skinSelect.value;
  localGame.setSkin(getSkin(settings.skinId));
  onlineGame.setSkin(getSkin(settings.skinId));
  saveSettings(settings);
});

const selectTab = (id: 'single' | 'online') => {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === id));
  tabPanels.single.classList.toggle('active', id === 'single');
  tabPanels.online.classList.toggle('active', id === 'online');
};

tabs.forEach((tab) =>
  tab.addEventListener('click', () => selectTab(tab.dataset.tab as 'single' | 'online'))
);

createRoomBtn.addEventListener('click', () => {
  mode = 'online';
  localGame.stop();
  const name = nameInput.value.trim() || '玩家';
  net.connect(name);
  net.send({ type: 'createRoom' });
  net.send({ type: 'ready' });
});

joinRoomBtn.addEventListener('click', () => {
  mode = 'online';
  localGame.stop();
  const name = nameInput.value.trim() || '玩家';
  const room = roomInput.value.trim().toUpperCase();
  if (!room) {
    hud.setRoomStatus('请输入房间号');
    return;
  }
  net.connect(name);
  net.send({ type: 'joinRoom', roomCode: room });
  net.send({ type: 'ready' });
});

const updateTarget = () => {
  if (mode === 'local') localGame.setTarget(input.target);
};

setInterval(updateTarget, 16);

hud.renderAchievements(achievements);
renderLocalLeaderboard();
const initialQuest = quests[0];
if (initialQuest) hud.updateQuest(initialQuest);

requestAnimationFrame(() => renderer.render({
  width: canvas.width,
  height: canvas.height,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  player: {
    pos: { x: canvas.width * 0.5, y: canvas.height * 0.6 },
    radius: 26,
    color: getSkin(settings.skinId).body,
    outline: getSkin(settings.skinId).outline,
    accent: getSkin(settings.skinId).accent,
    facingRight: true
  },
  players: [],
  fishes: [],
  items: [],
  bubbles: [],
  ripples: [],
  particles: []
}));
