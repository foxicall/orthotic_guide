# 梅科輔具｜輔具選用指南

依身體部位或用途瀏覽《梅科輔具品項》的手繪標記商品。可搜尋品名、身體部位、需求或貨號，核對規格與對應頁碼，選擇尺寸後加入「我的評估清單」。清單儲存在目前的瀏覽器，支援數量調整、費用估算與複製 LINE 諮詢摘要。網站直接讀取隨建置提供的商品資料與圖片。

## 本機執行

請使用 Node.js 22.12 以上版本。

```sh
npm install
npm run dev
```

`npm run build` 會執行 TypeScript 檢查並輸出 `dist/`。可用 `npm run preview` 檢查正式建置。

## 重現原始型錄擷取

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r scripts/requirements.txt
python scripts/extract_products.py --output-root /tmp/orthotic-archive
```

腳本用 PyMuPDF 以 300 DPI 渲染根目錄的原始 PDF，用 OpenCV 找出候選墨跡，再按逐頁核對的範圍裁切。紙本背面透印和叉記已排除。由同一價格圈選的整組規格一併收錄。第 11 頁另圈選尺寸的護膝只收錄 L/XL。請將結果輸出至獨立目錄，避免覆蓋網站使用的高清商品圖和後續補充的臨床資料。

- `scripts/reviewed-products.json` 是人工核對的型錄轉錄資料。
- `public/assets/products/` 是裁去表格線後的商品圖。第 4 頁三款拉力帶沿用型錄共用圖。
- `src/data/products.json` 是網站使用的 30 個品項，含 64 個可核對貨號與 1 個待核對規格。
- `src/data/extraction-manifest.json` 列出 11 頁的入選品名、SKU、圈記與裁切座標。第 6 頁護腕的印刷貨號和價格辨識度不足，介面標為待核對。

規格引用追溯至商品型錄頁次。供貨與促銷為型錄紀錄，實際資訊以診所回覆為準。

## 研究引用

商品卡的編號開啟「研究證據」。原型錄規格和臨床文獻分開呈現。若研究使用的是同類輔具、不同配方或不同族群，適用差異會列在該則引用內。

## GitHub Pages

在儲存庫的 **Settings → Pages → Build and deployment** 將 **Source** 設為 **GitHub Actions**。推送到 `main` 時，工作流程會以鎖定的依賴建置網站，再部署 `dist/`。也可在 **Actions → Deploy to GitHub Pages** 手動執行。

預覽網址為 `https://foxicall.github.io/orthotic_guide/`（首次部署完成後生效）。
