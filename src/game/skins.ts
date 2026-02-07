export type Skin = {
  id: string;
  name: string;
  body: string;
  outline: string;
  accent: string;
  hue: number;
};

export const skins: Skin[] = [
  { id: 'aqua', name: '深海蓝', body: '#42f5e6', outline: 'rgba(255,255,255,0.7)', accent: '#76fff4', hue: 190 },
  { id: 'ember', name: '珊瑚红', body: '#ff6b6b', outline: 'rgba(255,255,255,0.7)', accent: '#ffd4d4', hue: 6 },
  { id: 'sunset', name: '落日橙', body: '#ffbf47', outline: 'rgba(255,255,255,0.7)', accent: '#ffe3a7', hue: 40 },
  { id: 'kelp', name: '海草绿', body: '#7cff7c', outline: 'rgba(255,255,255,0.7)', accent: '#c4ffd1', hue: 120 }
];

export const getSkin = (id: string) => skins.find((s) => s.id === id) ?? skins[0];
