# 冼冠宇 個人網站

依 `docs/personal-site-spec.md` 與 `docs/codex-prompt.md` 建立的雙語個人網站。使用 Next.js 15 App Router、TypeScript strict、Tailwind CSS v4、shadcn 風格 Button / Radix Dialog、next-intl、next-themes、Motion、Supabase（Postgres / Auth / Storage）、Resend 與 Claude API。

## 本機啟動

需要 Node.js 22 以上。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

開啟 [中文首頁](http://127.0.0.1:3000/zh) 或 [英文首頁](http://127.0.0.1:3000/en)。根路徑會依語言偏好導向中／英文；手動切換語言後會保留偏好與目前路徑、篩選條件。Windows 可能把 `localhost` 解析成 IPv6，本機測試一律用 `127.0.0.1`。

本次 Windows 環境使用 Node.js 24，下載依賴時需信任系統憑證。若在相同環境遇到 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`，可在安裝／建置前執行 `$env:NODE_OPTIONS='--use-system-ca'`，保留 TLS 驗證。

`.env.example` 預設 `DEMO_MODE=true`，能在沒有外部帳號時預覽完整前台。專案、經歷與技能都是示範內容，頁面會顯示提示，並設定 `noindex`。**正式部署（`VERCEL_ENV=production`，或 `NODE_ENV=production` 且已設定 `NEXT_PUBLIC_SUPABASE_URL`）會忽略 `DEMO_MODE=true`** 並在伺服器記錄一次警告，避免示範內容誤上線。

## 功能

### 前台

- `/zh`、`/en`：個人簡介、大頭照、Hashtag、經歷、專案與聯絡邀請。
- `/{locale}/projects`：分隔線作品列表，使用 URL 的 `tag` 參數篩選。
- `/{locale}/projects/{slug}`：案例研究、固定資訊欄、技術架構與圖片放大、前後專案。
- `/{locale}/articles`、`/{locale}/articles/{slug}`：文章列表（分頁）與 Markdown 內文；只顯示 `published` 且 `published_at` 已到的文章。
- `/{locale}/contact`：Email、社群、履歷入口，以及聯絡表單（Resend 寄信、寫入 `messages`、honeypot、以 IP 雜湊做速率限制）。
- `/resume/{zh|en}.pdf`：導向該語言的履歷；沒有檔案時導向聯絡頁，其他檔名回 404。
- 動態 OG 圖片、sitemap／robots、Vercel Analytics 與 Speed Insights。
- 預設深色主題，可切換淺色／跟隨系統；全螢幕手機選單、焦點管理、減少動態效果、404 與錯誤狀態。

### 後台 `/admin`

- 以 Supabase Auth 登入（`/admin/login`），只有 `ADMIN_EMAIL` 清單內的帳號能進入；未登入一律導向登入頁。
- `/admin/files`：Storage 檔案管理（`media`、`resume` bucket）、大頭照上傳；上傳只接受白名單 MIME（PNG／JPEG／WebP／GIF、PDF），不接受 SVG。
- `/admin/resume`：中英履歷 PDF 上傳並更新 `profile.resume_*_url`。
- `/admin/articles`：文章新增／編輯、草稿／排程／發布狀態，以及用 Claude API 產生另一語言的翻譯草稿（需要 `ANTHROPIC_API_KEY`）。
- `/admin/projects`：專案新增／編輯（案例研究五段、資訊欄、標籤、精選、排序、發布狀態）、封面／架構圖上傳、媒體與量化成果管理，以及 AI 翻譯草稿。
- `/admin/profile`：個人資料（姓名、定位句、目前狀態、簡介、地點、Email、SEO 描述）。
- `/admin/experiences`：經歷（工作／學歷／獲獎／活動）新增、編輯、排序與顯示切換。
- `/admin/social`：社群連結新增、編輯、排序與顯示切換。
- 所有寫入都走 service role client，並在成功後呼叫 `revalidateTag()`。

### 排程發布

- `GET /api/cron/publish`：驗證 `Authorization: Bearer $CRON_SECRET`，呼叫資料庫函式 `publish_due_content()` 把時間已到的 `scheduled` 內容改成 `published`，並對回傳的每個 slug 與列表快取標籤執行 `revalidateTag()`。
- `vercel.json` 設定每日 00:00 UTC 執行一次（`0 0 * * *`，Vercel Hobby 方案的上限）。Pro 方案可改成 `0 * * * *` 每小時執行；急著上線的內容可在後台直接設為 `published`。
- 在 Vercel 專案環境變數設定 `CRON_SECRET` 後，Vercel 會自動帶入該 header；本機可用 `curl -H "Authorization: Bearer <secret>" http://127.0.0.1:3000/api/cron/publish` 測試。

## 尚未開放時把網站關起來

網域上線了但內容還沒寫完時，在 Vercel 設 `SITE_LOCKED=true` 再重新部署，前台每一頁都會回 503 與一張等待頁，`robots.txt` 同時改成全部拒絕。503 是「稍後再來」而不是「這頁不存在」，爬蟲會再回來，不會把半成品記進索引。

後台 `/admin`、它的 API 與已經寄出去的分享連結不受影響，所以可以照常編輯內容、照常讓對方下載檔案。

自己要看前台時，另外設一個 `SITE_UNLOCK=<任意字串>`，用 `https://網域/en?unlock=<那串字>` 開一次，之後就會記在 cookie 裡正常瀏覽。`SITE_UNLOCK` 留空的話沒有人能通過，包含你自己。

要開放時把 `SITE_LOCKED` 刪掉或改成別的值，重新部署即可。Vercel 的環境變數要重新部署才會生效。

## Supabase 設定

Schema 由 Supabase CLI migration 管理，位於 `supabase/migrations/`，可重複執行（trigger／policy 先 drop 再 create，table／index 用 `if not exists`，function 用 `create or replace`，seed 全部 `on conflict`／`where not exists`）。

1. 建立 Supabase 專案，記下 project ref。
2. 套用 migration：

   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   這會建立資料表、RLS、Storage bucket（`media`、`resume`）、`publish_due_content()` 與 `contact_rate_limit_hit()`。若要預覽示範內容，可在**開發用**資料庫執行 [supabase/seed.sql](supabase/seed.sql)（固定 UUID，重複執行不會重複插入）。

   真實內容（依履歷整理的個人資料、經歷與專案草稿）在 [supabase/seed-real.sql](supabase/seed-real.sql)，執行 `npm run db:seed:real`（需先 `supabase link`）或貼到 SQL Editor。專案一律以草稿建立，請到 `/admin/projects` 補齊後再發布；標示【請確認】的欄位為推估值。
3. 在 Supabase 的 Authentication > Users 建立管理員帳號（Email + 密碼），Email 必須與 `ADMIN_EMAIL` 相符。
4. 在 `.env.local` 設定 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_EMAIL`，並設 `DEMO_MODE=false`。
5. 產生資料庫型別：

   ```powershell
   # 在 .env.local 設定 SUPABASE_PROJECT_ID
   npm run db:types
   npm run typecheck
   ```

   指令只有成功時才覆寫 `src/types/database.ts`。

公開查詢只使用 anon client，與登入 cookie 隔離。快取標籤為 `profile`、`experience`、`skills`、`projects`、`project:{slug}`、`posts`、`post:{slug}`；後台寫入與排程發布都會呼叫 `revalidateTag()`。`messages`、`contact_rate_limit`、`media_assets` 沒有任何公開 policy，只有 service role 能讀寫。

`src/lib/db/admin.ts` 使用 `server-only` 防止誤匯入 client bundle。不要為 service role key 加上 `NEXT_PUBLIC_`。

## 環境變數

完整清單與註解見 [.env.example](.env.example)。

| 變數 | 使用時機 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 正式網站的完整 HTTPS 網址，供 metadata、OG 圖片與 sitemap 使用 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 真實內容模式必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | 後台寫入、聯絡表單、排程發布（僅伺服器端） |
| `ADMIN_EMAIL` | 允許登入 `/admin` 的 Email，逗號分隔 |
| `ANTHROPIC_API_KEY` | 後台文章 AI 翻譯草稿（選填，未設定則隱藏功能） |
| `RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` | 聯絡表單寄信；寄件網域需先在 Resend 驗證 |
| `CRON_SECRET` | `/api/cron/publish` 驗證；同時作為聯絡表單 IP 雜湊的預設 salt |
| `CONTACT_HASH_SALT` | 選填，聯絡表單 IP 雜湊專用 salt |
| `DEMO_MODE` | 本機示範填 `true`；使用真實內容填 `false`；正式部署會忽略 `true` |
| `NEXT_PUBLIC_SENTRY_DSN` | 錯誤監控總開關（選填）；未設定時整套 Sentry 不會進入 bundle |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | 搭配 DSN 使用，供建置時上傳 source map；token 僅限建置環境 |
| `SUPABASE_PROJECT_ID` | 只供 `npm run db:types` 使用 |

`ADMIN_TOKEN`、`GOOGLE_TRANSLATE_API_KEY`、`NEXT_PUBLIC_GA_ID` 已移除：後台改用 Supabase Auth，翻譯改用 Claude API，分析改用 Vercel Analytics（不需環境變數）。

## 靜態履歷與原始素材

`public/resumes/*.pdf` 是**刻意公開**的靜態檔案（使用者決定），`/resume/{locale}.pdf` 在 profile 沒有 Storage 網址時會導向這裡。Logo 原稿、證件照與其他原始素材放在 repo 外的 `D:\website-assets`，`.gitignore` 排除所有 `*.pdf`，只保留 `public/resumes/*.pdf`。

## CI

`.github/workflows/ci.yml` 在 push／pull request 到 `main` 時執行：Node 22、`npm ci`、`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`（`DEMO_MODE=true`），接著安裝 Playwright Chromium 並執行 `npm run test:e2e`；失敗時上傳 `playwright-report/`。同一分支的新 push 會取消進行中的工作。

## Vercel 部署

1. 將專案推送到 GitHub，在 Vercel 匯入，Framework 選 Next.js，Node.js 22。
2. Production 環境變數：`NEXT_PUBLIC_SITE_URL`、Supabase 三把金鑰、`ADMIN_EMAIL`、`RESEND_*`／`CONTACT_*`、`CRON_SECRET`、`ANTHROPIC_API_KEY`（選填）、`NEXT_PUBLIC_SENTRY_DSN` 與 `SENTRY_*`（選填），並設 `DEMO_MODE=false`。Preview 環境可設 `DEMO_MODE=true`。
3. `vercel.json` 已宣告每日一次的 Cron（Hobby 方案上限）；Pro 方案可改為每小時。
4. 部署後測試兩語言、兩主題、後台登入、真實履歷與圖片、聯絡表單寄信與排程發布。`next/image` 只允許設定的 Supabase 主機與公開 Storage 路徑，若使用其他圖片主機需調整 `next.config.ts`。
5. 到 Vercel 的 Domains 加入網域，依顯示的 DNS 記錄設定，完成 HTTPS 驗證。

安全性 header：`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options: DENY`、`Content-Security-Policy: frame-ancestors 'none'`、`Permissions-Policy`；`/admin/*` 另加 `X-Robots-Tag: noindex, nofollow`。

## 驗證

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

啟動 `npm run start` 後，可另執行 `npm run audit:site`（可用 `SITE_URL` 指定網址，預設 `http://127.0.0.1:3000`）。它會以背景 Chrome 產生桌機／手機截圖與 Lighthouse 行動版 HTML、JSON 報告，放在 `artifacts/`。示範模式刻意禁止索引，因此 SEO 分數會受 `noindex` 影響；正式內容上線後需再次量測。

Playwright 本機使用已安裝的 Google Chrome，CI（`CI=1`）改用 Playwright 內建 Chromium。E2E 使用 production server，應以示範內容建置後執行。

測試涵蓋雙語空值回退、履歷語言、連結協定、翻譯鍵一致性、`DEMO_MODE` 正式環境守門，以及手機版四種語言／主題組合的 axe 掃描、URL 篩選、鍵盤焦點、圖片放大、404、履歷路由、文章頁、後台登入導向與聯絡表單。實際執行結果記錄在 [docs/implementation-status.md](docs/implementation-status.md)，變更歷程記錄在 [docs/development-log.md](docs/development-log.md)。

## 檔案導覽

| 路徑 | 內容 |
| --- | --- |
| `src/app/[locale]` | 前台路由與頁面 |
| `src/app/admin` | 後台（登入、檔案、履歷、文章） |
| `src/app/api/cron/publish` | 排程發布 Route Handler |
| `src/components` | 版面、互動與案例元件 |
| `src/app/globals.css` / `src/styles` | 雙主題 token、排版與版面 |
| `messages` | 中英介面文案 |
| `src/lib/db` | 伺服器端查詢、public／session／admin client |
| `src/lib/auth` | 管理員登入與 `ADMIN_EMAIL` 檢查 |
| `src/lib/demo` | 明確標示的示範內容 |
| `supabase/migrations` | 可重複執行的 schema migration |
| `supabase/seed.sql` | 由示範內容產生的可重複匯入 SQL |
| `tests` | 單元測試與瀏覽器驗證 |
| `docs` | 原始規格、進度與開發紀錄 |

更新示範內容後可用 `node --import tsx scripts/generate-seed.ts` 重新產生 SQL。

技術參考：[next-intl 路由設定](https://next-intl.dev/docs/routing/setup)、[Supabase CLI migrations](https://supabase.com/docs/guides/deployment/database-migrations)、[Supabase 型別生成](https://supabase.com/docs/guides/api/rest/generating-types)、[Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)、[Next.js 15.5](https://nextjs.org/blog/next-15-5)。
