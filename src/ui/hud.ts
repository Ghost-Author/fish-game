import type { Achievement } from '../game/achievements';
import type { Quest } from '../game/quests';
import type { LeaderboardEntry } from '../../shared/protocol';
import { skins, type Skin } from '../game/skins';

export class Hud {
  private scoreEl = document.getElementById('score') as HTMLDivElement;
  private sizeEl = document.getElementById('size') as HTMLDivElement;
  private levelEl = document.getElementById('level') as HTMLDivElement;
  private questEl = document.getElementById('quest') as HTMLDivElement;
  private overlay = document.getElementById('overlay') as HTMLDivElement;
  private roomStatus = document.getElementById('room-status') as HTMLDivElement;
  private achievementsEl = document.getElementById('achievement-list') as HTMLDivElement;
  private leaderboardEl = document.getElementById('leaderboard') as HTMLDivElement;
  private toastEl = document.getElementById('toast') as HTMLDivElement;
  private skinSelect = document.getElementById('skin-select') as HTMLSelectElement;

  constructor() {
    this.populateSkins();
  }

  showOverlay(show: boolean) {
    if (show) this.overlay.classList.add('visible');
    else this.overlay.classList.remove('visible');
  }

  setRoomStatus(text: string) {
    this.roomStatus.textContent = text;
  }

  updateScore(score: number, size: number, level: number) {
    this.scoreEl.textContent = `分数: ${score}`;
    this.sizeEl.textContent = `体型: ${size.toFixed(1)}x`;
    this.levelEl.textContent = `等级: ${level}`;
    this.pulse(this.scoreEl);
  }

  updateQuest(quest: Quest) {
    const progress = quest.id === 'size-2' ? quest.progress.toFixed(1) : Math.floor(quest.progress).toString();
    this.questEl.textContent = `任务: ${quest.title} (${progress}/${quest.target})`;
  }

  renderAchievements(list: Achievement[]) {
    this.achievementsEl.innerHTML = '';
    for (const ach of list) {
      const div = document.createElement('div');
      div.className = `achievement ${ach.unlocked ? '' : 'locked'}`;
      div.textContent = `${ach.title} - ${ach.desc}`;
      this.achievementsEl.appendChild(div);
    }
  }

  renderLeaderboard(entries: LeaderboardEntry[]) {
    this.leaderboardEl.innerHTML = '';
    if (entries.length === 0) {
      this.leaderboardEl.textContent = '暂无记录';
      return;
    }
    entries.slice(0, 8).forEach((entry, index) => {
      const div = document.createElement('div');
      div.className = 'achievement';
      div.textContent = `${index + 1}. ${entry.name} - ${entry.score}`;
      this.leaderboardEl.appendChild(div);
    });
  }

  toast(message: string) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => this.toastEl.classList.remove('show'), 1600);
  }

  private pulse(el: HTMLElement) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  populateSkins() {
    this.skinSelect.innerHTML = '';
    skins.forEach((skin) => {
      const option = document.createElement('option');
      option.value = skin.id;
      option.textContent = skin.name;
      this.skinSelect.appendChild(option);
    });
  }

  setSkin(id: string) {
    this.skinSelect.value = id;
  }

  getSelectedSkin(): Skin {
    const id = this.skinSelect.value || skins[0].id;
    return skins.find((s) => s.id === id) ?? skins[0];
  }
}
