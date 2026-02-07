export type Achievement = {
  id: string;
  title: string;
  desc: string;
  unlocked: boolean;
};

export const defaultAchievements: Achievement[] = [
  { id: 'first-eat', title: '第一口', desc: '吃掉第一条小鱼', unlocked: false },
  { id: 'size-2', title: '小有成就', desc: '体型达到 2.0x', unlocked: false },
  { id: 'size-3', title: '巨无霸', desc: '体型达到 3.0x', unlocked: false },
  { id: 'score-500', title: '破 500', desc: '分数达到 500', unlocked: false },
  { id: 'survive-180', title: '深海老手', desc: '生存 180 秒', unlocked: false }
];

export const loadAchievements = (): Achievement[] => {
  const raw = localStorage.getItem('fish.achievements');
  if (!raw) return defaultAchievements.map((a) => ({ ...a }));
  try {
    const parsed = JSON.parse(raw) as Achievement[];
    return defaultAchievements.map((a) => ({ ...a, ...(parsed.find((p) => p.id === a.id) ?? {}) }));
  } catch {
    return defaultAchievements.map((a) => ({ ...a }));
  }
};

export const saveAchievements = (list: Achievement[]) => {
  localStorage.setItem('fish.achievements', JSON.stringify(list));
};
