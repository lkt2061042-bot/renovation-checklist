# 祥信裝修工程網站 — 專案筆記

## 已定規則（每次改動都要遵守）

- **網站不顯示電話號碼**，亦不放任何個人資料（地址、電郵、身份證、住址）。
- 聯絡流程：訪客填需求單 → 按「複製摘要」或「列印／存成 PDF」→ 貼回他們找到連結的
  WhatsApp／Instagram 私訊。網站本身不收集、不上傳任何資料。
- 品牌只用：logo（黃 #F2B500＋深灰 #14161A）、6 個屋苑完工實景、公開服務範圍。
- 不使用 `2022_CV.pdf`（個人作品集，含人像照與素描，與業務無關）。

## 資料來源

- `C:\Users\user\Desktop\company\logo.jpg` → `assets/logo.png`、`assets/logo-white.png`
- `company\` 下 6 個屋苑資料夾，共 52 張相片 → 精選 35 張
  - 北角 港運城 / 大坑 昍逵閣 / 太古城 金山閣 / 比華利山 / 沙田 畢架·金峰 / 西半山 嘉兆臺

## 建置流程

| 檔案 | 用途 |
|---|---|
| `template.html` | 版型與內容來源（含 `__PROJECTS_JSON__`、`__SITE_URL__`、`__JSONLD__` 等佔位符） |
| `build_assets.py` | 由原始相片產生壓縮圖、縮圖、封面、hero、logo、og 圖 |
| `render.py` | 把 `projects.json` 與 `contact.json`（如有）注入 template，輸出 `index.html` |
| `deploy.py` | 用 GitHub Git Data API（blob → tree → commit）部署到 GitHub Pages |

## 部署須知

- Repo：`lkt2061042-bot/renovation-checklist`，Pages 由 `main` 分支根目錄發佈
- 網址：https://lkt2061042-bot.github.io/renovation-checklist/
- **GitHub 會把 tree 內的 `content` 當純文字**，必須先 `POST /git/blobs`（base64）再組 tree，
  否則檔案會變成一大串 base64（已踩過一次）。
- 部署需要 `repo` 權限的 token；舊 token 已於 2026-10-31 撤銷（回 401）。

## 狀態

- 已完成並上線：品牌頁首、7 大工程、6 屋苑相簿＋燈箱、需求單＋即時摘要、列印 PDF、FAQ、SEO
- 已改好但未上線（等新 token）：聯絡區改成「不設電話查詢」的文案＋列印按鈕＋摘要計數修正
