# 幾A幾B — 線上多人猜數字

開房間、傳代碼，輪流出題、輪流猜。支援即時同步。

## 怎麼玩

1. 一位玩家當出題者，設定 4 位不重複數字密碼
2. 其餘玩家輪流猜
3. **A** = 數字對且位置對；**B** = 數字對但位置錯
4. 猜中 4A 得分，換下一位出題

## 本機啟動

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 後端（Socket.io）：http://localhost:3001

正式環境：

```bash
npm run build
npm start
```

瀏覽器開啟 http://localhost:3001

## 部署到公網

### Render（建議，免費額度）

1. 把這個 repo 推到 GitHub
2. 到 [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
3. 選擇此 repo（已含 `render.yaml`）
4. 建立後會得到類似 `https://ji-a-ji-b.onrender.com` 的網址

或手動建立 Web Service：Build `npm ci && npm run build`、Start `npm start`、Health Check `/health`。

### Docker / Fly.io

```bash
docker build -t ji-a-ji-b .
docker run -p 3001:3001 ji-a-ji-b
```

Fly：

```bash
fly launch --no-deploy   # 若尚未建立 app
fly deploy
```

### 本機臨時公開（Cloudflare Quick Tunnel）

```bash
npm run build && npm start
# 另一個終端
cloudflared tunnel --url http://127.0.0.1:3001
```

## 技術

- React + Vite
- Express + Socket.io
- 房間狀態在記憶體中（重啟伺服器會清空）
