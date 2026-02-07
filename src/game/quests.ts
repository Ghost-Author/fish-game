export type Quest = {
  id: string;
  title: string;
  target: number;
  progress: number;
  done: boolean;
};

export const createDailyQuests = (): Quest[] => [
  { id: 'eat-5', title: '吃掉 5 条小鱼', target: 5, progress: 0, done: false },
  { id: 'score-300', title: '累计分数 300', target: 300, progress: 0, done: false },
  { id: 'size-2', title: '体型达到 2.0x', target: 2, progress: 0, done: false }
];
