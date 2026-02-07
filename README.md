# 大鱼吃小鱼

技术栈：TypeScript + Vite + Canvas + WebSocket

## 本地运行

```bash
npm install
npm run dev
```

## 启动联机服务器

```bash
cd server
npm install
npm run dev
```

服务默认监听 `ws://localhost:5175`

## 说明
- 鼠标/触控移动（移动端支持虚拟摇杆）
- 吃掉更小的鱼，避开更大的鱼
- 道具：加速/护盾/减速/磁吸
- 成就、任务、排行榜（本地与联机）
