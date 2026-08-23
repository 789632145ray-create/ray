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

## 技術

- React + Vite
- Express + Socket.io
- 房間狀態在記憶體中（重啟伺服器會清空）
