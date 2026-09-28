# Development Log

This file keeps an append-only record of implementation work, runtime issues, fixes, and verification notes for release/version management.

## 2026-09-16

### Admin File Manager

- Added `/admin/files` for Supabase Storage file management.
- Supported `media` and `resume` buckets.
- Added prefix-based folder browsing.
- Added file upload with `ADMIN_TOKEN` validation.
- Added file deletion with `ADMIN_TOKEN` validation.
- Added public URL links for uploaded files.
- Added responsive admin table and form styles.

Verification:

- `npm run typecheck`
- `npm run lint`
- `NODE_OPTIONS=--use-system-ca` and `DEMO_MODE=true` with `npm run build`
- Confirmed `/admin/files` returned `200`.

### Profile Photo Management

- Added a dedicated profile photo upload form in `/admin/files`.
- Uploaded profile photos to the `media` bucket under `avatar/`.
- Updated `profile.avatar_url` after successful upload.
- Revalidated the `profile` cache tag and `/zh`, `/en`, `/admin/files` paths after update.
- Added homepage rendering for `profile.avatar_url`.
- Added responsive homepage photo layout.

Verification:

- `npm run typecheck`
- `npm run lint`
- `NODE_OPTIONS=--use-system-ca` and `DEMO_MODE=true` with `npm run build`
- Confirmed `/admin/files` and `/zh` returned `200` after restarting the dev server.

### Localhost / Dev Server Notes

- Found that `localhost:3000` failed because the dev server process had exited.
- Restarted `npm run dev`.
- Confirmed `127.0.0.1:3000/admin/files` and `127.0.0.1:3000/zh` returned `200`.
- Noted that Windows may resolve `localhost` through IPv6 `::1`; `127.0.0.1` can be used as a stable local URL.
- Noted repeated Google Fonts fallback warnings in dev mode when network/certificate access is limited.

### Upload Failure: Server Action Body Limit

- Observed runtime upload failure:
  - Browser error: `TypeError: Failed to fetch`
  - Server log: `Body exceeded 1 MB limit`
  - Request result: `POST /admin/files 500`
- Root cause: Next.js Server Actions default request body limit is `1 MB`.
- Fix: configured `experimental.serverActions.bodySizeLimit` to `8mb` in `next.config.ts`, matching the app's upload validation limit.
- Adjustment: increased `experimental.serverActions.bodySizeLimit` to `12mb` so multipart form overhead does not make an 8 MB file fail before app-level validation runs.

Follow-up verification needed after dev server restart:

- Restart `npm run dev`.
- Upload an image larger than `1 MB` and smaller than `8 MB`.
- Confirm profile photo updates on `/zh` and `/en`.

### Local Admin Token Setup

- Found that `.env.local` did not exist.
- Created `.env.local` from the expected environment variable shape.
- Set `ADMIN_TOKEN` for local admin form validation.
- Restarted the dev server so Next.js reloads `.env.local`.

Security note:

- `.env.local` is local-only and should not be committed or shared.
- Supabase upload actions still require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` before real cloud uploads can succeed.

### Upload Failure: Missing Supabase Credentials

- Observed runtime failure after submitting the profile photo form:
  - Error: `Missing server-side Supabase credentials.`
  - Source: `src/lib/db/admin.ts`
- Root cause: `ADMIN_TOKEN` was configured, but `.env.local` still did not include Supabase credentials.
- Fix: wrapped admin Supabase client creation in file-manager actions so missing credentials return a form-level error message instead of crashing the page.
- Required values for real uploads:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Profile Photo Upload Transport Change

- Observed repeated browser-side `TypeError: Failed to fetch` from `fetchServerAction` during profile photo uploads.
- Root cause: profile photo upload was still using a Server Action, so body-size and dev-server interruption errors surfaced as opaque fetch failures.
- Fix:
  - Added `POST /admin/files/profile-photo` as a Route Handler for profile photo uploads.
  - Changed `ProfilePhotoForm` to submit with a normal client-side `fetch`.
  - Kept form-level JSON errors for invalid token, large file, invalid MIME type, and missing Supabase credentials.
- This avoids the `fetchServerAction` path for profile photo uploads.

### Upload Failure: Missing Storage Bucket

- Observed Supabase upload failure:
  - Error: `Bucket not found`
- Root cause: Supabase credentials were present, but the `media` Storage bucket had not been created in the connected project.
- Fix:
  - Updated `POST /admin/files/profile-photo` to call `getBucket('media')` before upload.
  - If the bucket is missing, the route now creates a public `media` bucket with the expected 8 MB file limit and image MIME type allowlist.
  - Rewrote the route messages in readable Chinese after earlier encoding corruption.

### Upload Failure: Invalid Storage Object Key

- Observed Supabase upload failure:
  - Error: `Invalid key: avatar/profile-photo-...-冼冠宇_兩吋半身證件照電子檔.jpg`
- Root cause: Supabase Storage rejected the object key generated from a non-ASCII original filename.
- Fix:
  - Profile photo uploads now generate ASCII-only object keys and preserve only a safe image extension.
  - General file upload filename sanitization was tightened to ASCII word characters, dots, and hyphens.

### Footer / Brand Name Source

- Observed footer still showing `© 2026 Hsien` after updating Supabase profile data.
- Root cause: footer copyright, site brand, and page metadata titles were hard-coded in `messages/zh.json` and `messages/en.json`, not sourced from Supabase profile fields.
- Fix:
  - Updated Traditional Chinese brand/copyright/title text to `冼冠宇`.
  - Updated English brand/copyright/title text to `Kuan-Yu Hsien`.

### Personal Style Refresh

- User selected the following visual direction:
  - Professional and reliable.
  - Dark gray/black with white text.
  - Logo used as a small top-left brand mark.
  - Prominent profile photo.
  - Keep current homepage content structure.
  - Calm and rational personality.
  - Refined interaction.
  - Project presentation should combine imagery with resume-like information density.
  - Keep current locale setup.
  - Apple-like whitespace.
- Preserved pre-refresh files in `artifacts/version-backups/2026-09-17-pre-personal-style/`.
- Copied `網站LOGO.jpg` to `public/brand-logo.jpg` for stable site usage.
- Updated header, default theme, homepage/project-list styling, color tokens, metadata title, and interaction polish.

### Homepage Order And Social Icons

- Updated homepage order to `Skills -> Experience -> Featured Projects`.
- Added icon links below the `Currently` line:
  - Gmail/email uses `profile.email`.
  - GitHub, LinkedIn, and Instagram use rows in `social_links`.
- Kept missing social links hidden instead of rendering empty icons.
- Updated profile positioning defaults to `Software Engineer`.
- Kept the `Currently` text on one line at desktop widths so `roles` does not wrap alone.
- Rewrote `src/lib/demo/profile.ts` to remove old encoding corruption and include clean demo social links.
- Adjusted hero social icons to show only three links in this order: Gmail, LinkedIn, GitHub.
- Gmail now reads from `profile.email`, with optional fallback to a `social_links` row whose platform is `email` or `gmail`.
- Bumped the profile cache key to `profile-v2` and reduced profile revalidation from 300 seconds to 30 seconds, so direct Supabase SQL edits to profile/social links appear faster.

### Header Logo Transparency Update

- User provided a revised `D:\website\網站LOGO.jpg`.
- Created `public/brand-logo-transparent.png` with transparent corners/background and removed the bottom floor/shadow area.
- Updated only the header logo background image reference from `/brand-logo.jpg` to `/brand-logo-transparent.png`.
- Kept the previous `public/brand-logo.jpg` in place for rollback.

### Homepage Hashtag And Project Label Update

- Changed homepage project section label from `Selected projects` / `精選專案` to `Project`.
- Removed the visible Skills section from the homepage.
- Added five oval hashtag pills in its place:
  - `#SoftwareEngineer`
  - `#Data`
  - `#AI`
  - `#FullStack`
  - `#Cloud`
- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-17-before-hashtag-project-label/`.

### Section Heading Dot Icons

- Added a small black dot icon before the homepage `Experience` and `Project` headings.
- Scoped the styling to `.experience-section` and `.project-section` so other section headings stay unchanged.

### Homepage CTA Copy Update

- Updated the homepage invitation heading in both locale files to `Tangible Outcomes. Powered by Engineering.`.

### Article Publishing Feature And Responsive Homepage Tweaks

- Added public article routes:
  - `/zh/articles` and `/en/articles`
  - `/zh/articles/[slug]` and `/en/articles/[slug]`
- Added `Articles` to the main navigation.
- Wired public article pages to the existing Supabase `posts` table, showing only published articles whose `published_at` is not in the future.
- Integrated the existing admin article workflow:
  - `/admin/articles`
  - `/admin/articles/new`
  - `/admin/articles/[id]`
- Article admin supports Markdown content, draft/published/scheduled/archived status, tags, cover image URL, excerpts, reading minutes, and delete confirmation.
- Cleaned article server actions to use the logged-in admin session and revalidate public article pages after changes.
- Moved homepage focus keywords under the Gmail/LinkedIn/GitHub icons.
- Changed homepage focus keywords from boxed `#Hashtag` pills to small-dot keyword items.
- Changed the homepage `Experience` heading to use the previous oval pill visual style.
- Kept `Project` with the small-dot heading style.
- Relaxed forced no-wrap styling in the hero status line so narrow screens can wrap cleanly instead of overflowing.

### Signature Frontend Design Pass

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-signature-design/`.
- Added a compact homepage `Design principles` strip below the social links:
  - `Clarity over decoration`
  - `Systems before surfaces`
  - `Useful motion only`
- Changed the English navigation label from `Articles` to `Notes` and the article index title to `Engineering Notes`.
- Upgraded project rows from a simple portfolio list into a compact engineering case-study preview:
  - `Problem`
  - `System`
  - `Outcome`
- Added responsive styling for the new project signal grid so it stacks on mobile and becomes three columns on wider screens.
- Refined nav underline spacing and project hover details to make the site feel more custom without adding decorative clutter.

### Continuous Stroke Logo Revision

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-logo-continuous-stroke/`.
- Reworked the header brand SVG from separated strokes into one continuous stroke.
- Synced the same continuous mark to `public/brand-logo.svg` and Open Graph cards.

### Original Logo Cutout Update

- Used `D:\website\網站LOGO.jpg` as the source logo image.
- Generated a transparent-background logo cutout at `public/brand-logo-cutout.png`.
- Generated a smaller header-optimized transparent PNG at `public/brand-logo-header.png`.
- Updated the header `BrandMark` component to use the original-logo PNG instead of the hand-drawn SVG approximation.

### Homepage Section Heading Style Sync

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-section-heading-pill-sync/`.
- Updated `Project` to use the same oval pill heading style as `Experience`.
- Increased `Experience` heading text back to the same large heading scale as `Project`.
- Removed the small dot icon from `Project`.

### Section Heading Redesign

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-section-heading-redesign/`.
- Replaced the oval pill section headings with a more intentional index-heading system:
  - circular section number
  - large section title
  - horizontal rule extending across the row
- Kept the `All projects` link responsive: below the heading on narrow screens and aligned right on wider screens.
- Adjusted the desktop `Project` heading grid so it keeps the same number/title/rule structure as `Experience`, with `All projects` sitting to the far right instead of replacing the rule.

### Homepage Research Section

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-research-section/`.
- Added a third indexed homepage section: `03 Research`.
- Added localized empty-state copy for research content in `messages/en.json` and `messages/zh.json`.
- Extended the shared section-heading design to `research-section`.

## 2026-09-18

### Site Audit And Infrastructure Fixes

Full-site audit covering security, database, unfinished features, admin tooling and engineering hygiene. Decisions recorded from the user:

- Replace `ADMIN_TOKEN` with Supabase Auth login at `/admin/login`, restricted to the `ADMIN_EMAIL` allowlist.
- No SVG uploads; the `media` bucket MIME allowlist is PNG / JPEG / WebP / GIF only.
- `public/resumes/*.pdf` stay as intentionally public static files; original assets live outside the repo in `D:\website-assets`.
- Analytics via Vercel Analytics (no env var); translation drafts via Claude API (`ANTHROPIC_API_KEY`); `GOOGLE_TRANSLATE_API_KEY` and `NEXT_PUBLIC_GA_ID` removed.
- Scheduled publishing via `GET /api/cron/publish` with `CRON_SECRET`, hourly in `vercel.json` (daily on Vercel Hobby).

Infrastructure changes:

- Split the root `supabase-schema.sql` into idempotent Supabase CLI migrations: `supabase/migrations/20260918000000_init.sql` (schema, RLS, buckets, `publish_due_content()`) and `20260918000100_contact_rate_limit_fn.sql` (`contact_rate_limit_hit(p_ip_hash, p_limit, p_window)`, `security definer`, service_role only). Removed the root schema and the stale `docs/supabase-schema.sql`. Added a minimal `supabase/config.toml`.
- Moved the development-only profile / social_links seed out of the schema and into `supabase/seed.sql` (`where not exists` guards) so re-running migrations never overwrites real profile data.
- `src/lib/db/config.ts`: `DEMO_MODE=true` is ignored on production deployments (`VERCEL_ENV=production`, or `NODE_ENV=production` with `NEXT_PUBLIC_SUPABASE_URL`) with a single `console.warn`.
- `src/app/api/cron/publish/route.ts`: Bearer check, RPC call, `revalidateTag` for `posts` / `projects` and per-slug tags.
- `next.config.ts`: clear error when `NEXT_PUBLIC_SUPABASE_URL` is not a URL; added `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Permissions-Policy`.
- `.env.example` rewritten with comments for the new variable set.
- Tests: unit test for the `DEMO_MODE` guard (runs `config.ts` in a child process under the `react-server` condition); Playwright theme matrix now selects light mode through the theme `<select>` because the default theme is fixed to dark; new e2e cases for articles pages, admin login redirect, `/resume/xx.pdf` 404 and the contact form. `playwright.config.ts` uses bundled Chromium when `CI` is set.
- `.github/workflows/ci.yml`: typecheck, lint, unit tests, demo build, Playwright Chromium, report upload on failure, cancel-in-progress concurrency.
- `scripts/audit-site.mjs`: `SITE_URL` override defaulting to `127.0.0.1`, random remote-debugging port, null-safe Lighthouse scores.
- README and `docs/implementation-status.md` rewritten for the end state; verification items marked pending re-run.

Verification:

- `npx tsx --test tests/content.test.ts`: 5 passed.
- `npx tsc --noEmit` and `npx eslint` on the owned files: see implementation-status for the post-merge re-run.
- Migration SQL reviewed by hand for idempotency; not yet applied to a live database.

### Contact List Redesign

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-contact-list-redesign/`.
- Reworked the Contact page list so Email uses the same visual scale as the other contact rows.
- Added icon-led rows for `Country / Region`, `Phone`, `LineID`, `IG`, `LinkedIn`, and `GitHub`.
- Added reusable copy-button behavior through `CopyValue`, with copy actions for Email, Phone, LineID, IG, LinkedIn, and GitHub.
- Kept `Country / Region` as display-only text: `Taiwan, Taipei, Da'an Dist`.
- Added responsive contact-list CSS so labels, values, and copy buttons stack cleanly on mobile and align in columns on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Local page check confirmed the new Contact fields render at `/en/contact`.

## 2026-09-19

### Homepage Wide Layout

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-home-wide-layout/`.
- Added a homepage-only `home-container` class so the landing page can use more horizontal space on large screens.
- Kept the default `.container` width unchanged for content-heavy pages like Contact, Notes, Projects, and admin screens.
- Increased the homepage desktop hero column gap fluidly and allowed the profile photo to scale up to `480px` on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Email Compose Link

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-home-email-compose/`.
- Added `gmailComposeUrl()` so homepage Email/Gmail icon can open Gmail compose with the recipient prefilled.
- Updated the homepage social Email icon to use Gmail compose instead of relying only on the browser's `mailto:` handler.
- Kept other email links on the site as `mailto:` for now.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Local HTML check could not run because `127.0.0.1:3000` was not responding.

## 2026-09-20

### Homepage Full-Width Layout

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-home-full-width/`.
- Removed the homepage-only `1560px` max-width so the landing page now uses the full viewport width.
- Kept responsive side padding through viewport-based clamps instead of centering the entire page in a fixed-width block.
- Expanded the desktop hero grid and portrait sizing at `1280px+` and `1680px+` breakpoints so large screens feel intentionally filled.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Edge-Aligned Header And Footer

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-edge-aligned-shell/`.
- Removed the fixed content max-width from `header-inner` and `footer-inner` so shell navigation uses the full viewport width.
- Kept the main `.container` behavior unchanged for readable page content.
- Right-aligned the footer note/copyright group while keeping social/contact links on the left.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Positioning Copy

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-home-positioning-copy/`.
- Changed the homepage tagline to `Curiosity driven, clarity obsessed.`.
- Reframed the three homepage principles as a personal user manual:
  - `Why before How`
  - `Radically Candid`
  - `Embrace the Iteration`
- Synced the development Supabase seed profile bio with the new tagline.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Move Portrait To Contact

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-moving-photo-to-contact/`.
- Removed the profile portrait from the homepage hero.
- Added the portrait to the Contact page intro, paired with the contact opening copy.
- Added responsive styling so the portrait stacks below the intro on mobile and aligns right on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Cubist Backdrop

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-cubist-backdrop/`.
- Added `CubistBackdrop`, a client canvas behind the homepage hero in the spirit of analytic cubism: the canvas is fractured into interlocking facets by seeded line cuts, painted in earth pigments (ochre, umber, prussian, oxblood, olive, gold) with hatching, guide lines and arcs.
- The composition breathes slowly (per-facet scale, rotation, light sweep) and shifts with the pointer by depth; it is static under `prefers-reduced-motion`, pauses off-screen and when the tab is hidden, and re-renders on theme change.
- The seed is fixed so every visit shows the same composition; pigment is weighted toward the portrait side and faded toward the copy column and the sections below so text stays readable.
- Added a paper-grain overlay and a gold offset frame plus skewed back facet behind the hero portrait so it reads as one plane of the composition.
- `Reveal` now clears its inline `clip-path` once the intro finishes so decoration that overhangs a revealed box is not clipped.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Playwright screenshots (Edge channel) of `/en` at 1600px light and dark and 390px dark confirmed the backdrop renders, the portrait frame shows, and hero copy stays readable.

### File Management Extension Research (2026-09-20)

- Added [the extension research report](file-management-extension-research.md) for a single-admin content and asset library with public visitor access only to published content.
- Reviewed the existing upload, deletion, profile-photo, resume, article, authentication, Storage schema, and publishing flows against the prior 11-page file-management presentation.
- The requested legacy source directory was not present. The available reference was `檔案管理系統-垃圾桶.pdf`; its incomplete architecture sections are documented as proposals, not verified working legacy code.
- Compared Supabase Free and Cloudflare R2 using official pricing and platform documentation, including Vercel upload and cron limits.
- Proposed direct uploads, private originals, explicit publication, asset references, recoverable deletion, versions, sharing, audit events, capacity controls, and separate database/object backups.
- Included staged migration, rollback constraints, a file-level implementation map, and acceptance criteria. No application code, database, or deployment was changed by this research task.

Verification:

- Extracted all PDF page text and inspected rendered architecture/schema pages 5, 7, 9, and 10.
- Cross-checked the findings against local source and official provider documentation.
- Application tests were not run for this documentation-only task; proposed integration and deployment checks are listed in the report.

### Advanced File Management Architecture Research (2026-09-20)

- Extended the research report with sections 17-19: release snapshots, durable jobs and recovery, deduplication, document search, draft conflicts, observability, and backup/fault drills.
- Defined demo scenarios and acceptance criteria for each proposal, plus dependencies and recommended implementation order.
- Clarified queue delivery versus idempotent effects, worker scheduling and resource limits, private search filtering, and database versus CDN publication consistency.
- Cross-checked Supabase Queues/Cron, Postgres search and transaction documentation, and Next.js 15 OpenTelemetry guidance.
- This continuation only updates research documentation; no feature implementation, infrastructure changes, or deployment. Application tests were not run.

### Asset Library Phase 1 Verified And Continued (2026-09-20)

Picked up the asset library where the previous session (Codex) stopped after its rate limit. What was already on disk: `src/lib/assets/*`, `/api/admin/assets`, the `AssetWorkspace` / `AssetUpload` components, migrations `20260920000100_asset_library.sql` and `20260920000200_media_dimensions.sql`, SQL / component / browser tests and `docs/asset-library-setup.md`.

State found and fixed:

- `tests/components/asset-server.test.tsx` did not typecheck (`ReturnType<typeof vi.fn>` mocks are not callable under Vitest 5); typed the `rpc` / `upload` / `download` mocks explicitly.
- `scripts/test-assets-sql.mjs` only passed on a fresh database: leftover rows from a previous run broke the usage assertions. The runner now drops and recreates the `public` / `auth` / `storage` schemas of `asset_library_test` before every run.
- Another Claude Code session was working in the same tree at the time (accessibility / typography verification, `zz-*` probes, `.typo-check/`). Those files were left alone.

New in this session (snapshot in `artifacts/version-backups/2026-09-20-before-asset-references/`):

- `supabase/migrations/20260920000300_asset_references.sql`: `asset_references(actor, asset)` reports where each completed public copy is used (profile avatar / resume slots, project cover / architecture / Markdown bodies, gallery rows, article cover / bodies). `asset_change('trash')` now raises `ASSET_REFERENCED` only while such a reference exists; published-but-unreferenced assets can be recycled (public objects are never deleted). `asset_library_usage()` stops counting a pending upload / publication reservation 24 hours after it was signed, so cancelled or abandoned uploads no longer occupy the budget forever.
- Server: asset detail includes `references`; new `view=published` listing for the editors; `ASSET_REFERENCED` error copy; setup-required message now points at all `20260920*` asset migrations.
- UI: the inspector shows a 使用位置 section with links to the admin page that uses the file, and the trash button follows the reference rule. New `AssetPicker` dialog (`src/components/admin/asset-picker.tsx`) lets the project URL fields and the article cover field pick an already published file; images offer one-click Markdown copy for bodies.
- Tests: SQL fixture gains minimal `posts` / `projects` / `project_media`; the SQL test covers references, owner scoping, the relaxed trash rule and lapsing reservations; all three asset migrations are applied twice for repeatability. The browser test asserts the reference list after publishing and exercises the picker (open, axe, search, select, 390px, Escape). `docs/asset-library-setup.md` updated accordingly.

Not done here: the production Supabase migrations are still not applied (needs the owner's decision and a backup first), no end-to-end run against real Storage, and no commit was made because the working tree also holds other sessions' unfinished work.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 16 pre-existing warnings (documented in `docs/testing.md`).
- `npm test`: 73 passed.
- `npx vitest run tests/components/asset-http.test.tsx tests/components/asset-server.test.tsx`: 10 passed.
- `node scripts/test-assets-sql.mjs` (local PostgreSQL 18 on 127.0.0.1:55432): passed, including the new reference and reservation assertions.
- `node tests/assets-browser.mjs` (Chrome): passed, including the reference list and picker scenarios; screenshots in `artifacts/asset-library/`.
- `npx prettier --check` on the touched test files: passed.

### Asset Library: Revoke Public Copies (2026-09-20)

- `supabase/migrations/20260920000400_asset_revoke.sql`: publications gain a `revoked` status plus `revoked_at` / `purged_at`. `asset_revoke_publication()` refuses while the copy is still referenced (`ASSET_REFERENCED`), refuses pending publications (`PUBLICATION_PENDING`), is owner scoped and idempotent, and writes a `publish.revoked` event; `asset_publication_purged()` records the confirmed object removal.
- Server `revokePublication()` works in two steps on purpose: the row flips to `revoked` first (listings, the picker and the reference scan ignore it immediately), then the public object is removed from Storage and its `image_metadata` row dropped; if removal fails the row keeps `PURGE_RETRY_NEEDED` and the same action retries the purge. Private originals and versions are untouched. The asset list's 有公開副本 flag now counts only completed copies.
- UI: each row under 公開紀錄 has a 撤銷公開 action (disabled with an explanation while referenced, confirm dialog, retry state when the object removal is still pending).
- Committed as its own commit; the Vitest component tests for the library (`tests/components/asset-*.test.tsx`) stay uncommitted until the Vitest tooling from the frontend session lands, because the root tsconfig compiles them.

Verification:

- `npx tsc --noEmit`: passed. ESLint on the touched files: no errors.
- `node scripts/test-assets-sql.mjs`: passed (four migrations applied twice; revoke blocked while referenced, idempotent revoke, purge, pending refusal).
- `npx vitest run tests/components/asset-http.test.tsx tests/components/asset-server.test.tsx`: 11 passed, including Storage removal failure followed by a successful retry.
- `node tests/assets-browser.mjs`: passed, including the revoke flow on an unreferenced copy and the protected state on a referenced one.
- The previous commit (`fac8958`) was also verified on its own in a detached worktree: typecheck, 58 unit tests, SQL and browser suites all passed.

### Article Revisions And Restore (2026-09-20)

Every successful article save now keeps the content that was stored, so a bad edit can be compared and undone.

- `supabase/migrations/20260920000500_post_revisions.sql`: `post_revisions` (post, revision number, jsonb snapshot, actor, reason, created_at) with RLS and service-role-only access, plus `post_save_revision()` which takes the next revision under a row lock and returns the existing latest row when the snapshot is identical, so pressing save twice does not fill the history with copies.
- `src/lib/diff.ts`: a dependency-free line diff (LCS over lines) with per-side line numbers, a fallback for very large texts, unchanged-run collapsing, and a snapshot comparison that reports only the editable fields that differ. Pure, so it runs in `tsx --test` and in the browser.
- `saveArticleAction` stores the pre-edit content first for articles that predate the table, then the newly stored content. `restoreRevisionAction` writes a revision back, forces the article to draft, keeps the live slug when the old one is taken by another article, and records the restore, so a restore can itself be undone. A history write never fails a save the database already accepted.
- The edit page gains a 修訂紀錄 panel: what each revision changed, a line diff against the current article, and a restore behind a confirm dialog. The editor remounts on `updated_at` so it shows the restored content.
- `asset_references()` now also reports retained article revisions, as a **soft** reference: it does not block recycling or revoking, because no live page depends on it, but the asset inspector lists it as a warning, since restoring that revision afterwards would point at a removed file. Trash and revoke were updated to ignore soft references explicitly.
- Fixed while here: `tests/assets-browser.mjs` read the preview image's `naturalWidth` once, which is a race on a loaded machine; it now polls.

Documentation: `docs/article-revisions.md`; `docs/testing.md` gained the database and admin-workspace layers it was missing.

Verification:

- `npx tsc --noEmit`: passed. ESLint on the touched files: 0 errors, 2 pre-existing warnings.
- `npm test`: passed, including 14 new diff tests.
- `npx vitest run`: 9 files, 65 tests passed, including 8 new `ArticleRevisions` tests.
- `node scripts/test-assets-sql.mjs`: passed, with five migrations applied twice and a new revisions suite (numbering, deduplicated snapshots, key-order independence, input validation, permissions, cascade, soft references not blocking recycling).
- `node tests/assets-browser.mjs`: passed.
- Not applied to production Supabase; not deployed.

### Time-Limited Share Links (2026-09-20)

A private version can now be handed to someone without an account, through a link that expires on its own and can be revoked.

- `supabase/migrations/20260920000600_asset_shares.sql`: `asset_shares` stores only the **SHA-256 of the token**, so neither a leaked table nor the server itself can reconstruct a working link; the plaintext exists once, in the reply that creates it. Plus `asset_create_share()` (ready version, live asset, expiry between a minute and 30 days, at most 20 live links per asset), the read-only `asset_peek_share()` for the landing page, `asset_redeem_share()` which increments the counter in the same statement that re-checks the cap, and `asset_revoke_share()`.
- Public surface: `/{locale}/share/{token}` shows the file name, size, expiry and open count, and `…/download` redeems. **Redeeming is POST, not GET**, because mail providers follow links in messages to scan them and would otherwise spend an open; the landing page itself only peeks. Redeeming returns a 60-second signed URL, so revocation stops new opens but cannot recall a URL handed out moments earlier — stated plainly in the docs and on the page.
- Admin: a 限時分享連結 panel on a ready version. It shows the URL once with a warning that it will not be shown again, then lists every link with its state, expiry, open count and last open, with revoke behind a confirm dialog.
- `asset_shares` is read through a `.catch(() => [])` in the asset detail, so an asset still opens before the migration is applied.

Documentation: `docs/asset-share-links.md`, including the limits this design does not claim to cover (no password, no identity, open count is not proof of a completed download).

Verification:

- `npx tsc --noEmit` and ESLint on the touched files: clean.
- `npm test`: passed, including new cases for the token shape (50 generated tokens against the accepted pattern) and for expiry, cap and label validation.
- `node scripts/test-assets-sql.mjs`: passed, with six migrations applied twice and a new share suite (permissions, hash format, expiry bounds, unverified version, non-owner, peek not spending an open, redeem counting, cap, idempotent revoke, expiry, trashed asset, 20-link ceiling).
- `node tests/assets-browser.mjs`: passed, including creating a link, the one-time reveal, the list and revoking.
- `npm run build`: passed, so the new public route and route handler compile and prerender.
- Not applied to production Supabase; not deployed.

### Homepage Layout Polish (2026-09-21)

Implemented update request:

- About/homepage text now stays inside the visual left boundary set by the header logo on desktop and mobile.
- Hero eyebrow text was removed, the résumé CTA now downloads the PDF directly, and the principle headings use a typewriter reveal before their body copy fades in.
- Experience, Project and Research section content aligns to the section title text, with experience dates moved after the role/title line.
- Footer links are limited to Email, LinkedIn and GitHub in that order.
- Contact was redesigned without the portrait, keeping direct email, résumé, copyable contact rows and the contact form.

### Background Music: A Public-Domain Recording Replaces the Synthesiser (2026-09-21)

The sound toggle now plays Chopin's Nocturne in F minor, Op. 55 No. 1, instead of generating plucked
notes. The two confirmation chimes are unchanged and still synthesised.

The hard part was licensing, not playback. A Chopin nocturne is out of copyright; a *recording* of one
is a separate work with its own rights, and most files advertised as "free classical music" are free
only in the first sense. The recording used here is from Musopen's Complete Chopin Collection, whose
archive.org item metadata carries `licenseurl = creativecommons.org/publicdomain/zero/1.0/` and was
uploaded by Musopen's founder — a CC0 dedication covering the performance itself, verified from the
metadata endpoint rather than from page copy.

- The piece was chosen by measurement, not taste: six candidate nocturnes and preludes were run
  through `ebur128`, and Op. 55 No. 1 had the narrowest loudness range (12.4 LU against 20.3 for the
  Raindrop prelude). A compressor took that to 6.0 LU and two-pass `loudnorm` set it to −19 LUFS, so
  the climax no longer jumps out from under a page. Encoded to Ogg Opus at 64 kbps (2.50 MB) with an
  AAC copy (3.19 MB) for Safari before 17.5; one or the other is fetched, never both.
- `MUSIC_GAIN` is 0.1, exactly −20 dB, which puts the file's −5.4 dBFS peak at about −25 dBFS at the
  page's output — the level the generative piece ran at. `outputPeakDbfs()` is the one expression for
  this and the test fails if it rises.
- Served from a new public `audio` bucket (`supabase/migrations/20260921000100_audio_bucket.sql`),
  addressed from `NEXT_PUBLIC_SUPABASE_URL` so no host is written into the source. Nothing downloads
  until the toggle is pressed: the `<audio>` element is built inside the graph, carries
  `preload="none"`, and `dispose()` clears `src` so a paused element cannot finish fetching.
- On a platform where `createMediaElementSource` is unavailable the element's own `volume` is the only
  control, and iOS ignores writes to it. The graph writes the gain, reads it back, and declines to
  play the music if the value did not take, rather than let the file out twenty decibels over brief.
- `src/lib/audio/track.ts` holds the recording's identity apart from the graph, so the footer can
  credit it without pulling Web Audio into a server component. CC0 requires no attribution; the line
  is there because saying where the music came from is worth one line.

One real bug surfaced while checking the new footer line on a phone. `src/app/[locale]/layout.tsx`
injects an inline `<style>` for the notch insets, and it contained
`.site-footer { padding-bottom: env(safe-area-inset-bottom); }`. Inline styles come last in document
order, so it had been silently overriding the clearance `styles/audio.css` declares for the floating
sound toggle — the earlier mobile-footer fix had never taken effect, and the toggle had been sitting
on top of the footer's last row all along. The footer's bottom padding now belongs to `audio.css`
alone, which folds the inset into it.

Documentation: `docs/background-music.md` (licensing check, the full encode chain, and how to swap the
piece); `docs/testing.md` gained the `AUDIO_VERIFY=1` section.

Verification:

- `npx tsc --noEmit`, Prettier and ESLint: clean (0 errors, 16 pre-existing warnings).
- `npm test`: 116 tests passed. `tests/audio.test.ts` was rewritten for file playback — 13 offline
  tests plus one gated by `AUDIO_VERIFY=1` that fetches both published encodes and measures the Opus
  file with `ffmpeg` against what `TRACK` claims. Run with the flag: −19.0 LUFS, 6.0 LU, −5.4 dBFS,
  matching.
- `npx vitest run`: 9 files, 65 tests passed.
- `npm run test:e2e`: 25 passed, including the axe sweep that first caught the credit line at 3.45:1
  (it now inherits the footer's `--graphite`).
- `npm run test:visual`: 16 passed. **Windows baselines updated; the Linux set still has to be
  committed from a CI run.**
- Applied to production Supabase (bucket created, both files uploaded with a one-year `cacheControl`).
  Not deployed.

### Depth on the Lists, and the Homepage Performance Debt Behind It (2026-09-21)

Experience, project and article rows now tip back and stand up as the page brings them into view, and
the homepage's main-thread cost was cut on the way.

**The effect.** Each row is hinged along its own bottom edge (`transform-origin: 50% 100%`), starts at
`rotateX(12deg)` and `translateZ(-170px)` against a 1000px perspective — 0.855 of its size — at 0.35
opacity, and arrives upright and solid. The attitude is a pure function of scroll position, not a timed
animation a scroll event kicks off, which is what makes it feel attached to the wheel. Phones take half
the angle and half the distance: a hard perspective across a 375px column throws the far edge a long way
off-axis, and angled text re-rastered on a phone GPU is the first thing to look cheap.

All of it is `animation-timeline: view()`, so the compositor drives it and the main thread does no work
per frame. That is the only reason a continuous scroll effect belongs on a page that also carries a
canvas; the same job written as a scroll handler would cost what the canvas already costs. Two gates:
`prefers-reduced-motion: no-preference`, and `@supports (animation-timeline: view())` so that Firefox,
which has no scroll-driven animations yet, keeps the fade-and-rise entrance `hero.css` declares.

`animation-fill-mode` is `forwards`, not `both`, and that is an accessibility decision rather than a
stylistic one. With `both` every row further down the page sits at the keyframe start with its text at
0.35 opacity; Lighthouse accessibility on the homepage fell from 100 to 97 with six colour-contrast
violations, all of them real for anyone whose page has stopped there. With `forwards` a row carries its
ordinary styling until the moment it starts to appear. Nothing looks different, because the range begins
while the row's top edge is still level with the bottom of the screen.

**The debt.** The homepage had been scoring 74 on performance against a floor of 85, with 990ms of total
blocking time while the other two measured routes sat at 95. CI had not caught when it happened, because
the visual step had been failing first on every run since and Lighthouse never executed.

Wall-clock measurement on this machine is useless — three runs of one unchanged build spread 318ms to
4231ms — so the diagnosis went through counters instead, via `Performance.getMetrics`, which count what
the page asks for rather than how long a loaded CPU takes to do it. The homepage asked for **541 style
recalculations** against the contact page's 34. A `disabled-by-default-devtools.timeline.invalidationTracking`
trace then attributed them.

Two causes, both waste rather than design:

- `cubist-backdrop.tsx` wrote `canvas.style.transform` and `.opacity` straight from its scroll handler.
  A wheel fires scroll events faster than the screen refreshes, so that was a style invalidation per
  event, done inside the handler — which is also exactly what the reported judder feels like. The write
  is now coalesced onto one rAF and skipped entirely when the value has not moved. The canvas's share of
  task time fell from 628ms to 169ms.
- `section-reveal.tsx` set `element.dataset.active` on every observer callback. The observer carries
  nine thresholds across three sections, so it fires constantly on the way down the page, and writing an
  attribute that already holds its value still invalidates style for the section and everything under
  it. Both writes are now guarded.

The backdrop additionally runs at one frame in three while the page is moving, returning to full rate
180ms after the last scroll event. Behind moving text nobody can resolve its detail, and the frames are
worth more to the scroll.

Also: Chrome's overscroll bounce is switched off on pointer-fine devices, where against tipping rows it
read as the new effect springing back. Touch keeps it, because there the same gesture is pull-to-refresh.

Verification:

- `npx tsc --noEmit`, Prettier, ESLint: clean (0 errors, 16 pre-existing warnings).
- `npm test`: 123 passed, including a new `tests/motion.test.ts` — both gates present, the keyframes
  touching only `transform` and `opacity`, `forwards` rather than `both`, the amplitudes and the phone
  halving, the overscroll rule scoped, the backdrop's handler free of direct style writes, and the
  observer's guarded attribute writes.
- `npm run test:e2e`: 26 passed, including a new browser test that reads the tilt back off the row's own
  matrix — resting rows untransformed, an arriving row tipped and faint, an arrived row upright, and
  still upright after it has left the top.
- `npx vitest run`: 65 passed.
- `npm run test:visual`: 16 passed **with no baseline changes**, because the screenshots emulate reduced
  motion and the effect is gated behind it. Worth keeping: it means this class of work cannot silently
  churn the baselines.
- Counters after the fix: the homepage's style recalculations and its canvas cost are both down as
  described. **Lighthouse was not re-measured usefully** — a local run scored project-en at 85 where CI
  scores it 95, with the homepage moving in step, which is the machine rather than the build. CI is the
  measurement that counts.

### The Canvas Gets a Frame Budget (2026-09-21)

The first pass at the homepage's performance debt moved it from 74 to 77 and cut total blocking time
from 990ms to 740ms, but the CI profile then said plainly where the rest was: **"Other" main-thread
work is 7220ms on the homepage against 188ms on contact**, while Style & Layout is comparable on both
(494ms and 433ms). It is the canvas, and only the canvas.

Every frame the backdrop fills and strokes 42 polygons and clips a hatch through some of them, which
is pixel-bound work. Two caps, both of which trade nothing anyone can see:

- **Half the frames.** The light sweep takes 28 seconds to cross and the facets drift on 20-40 second
  cycles, so 30fps is indistinguishable from 60. While the page is moving it drops to 10 and a
  struggling machine gets 15; full rate returns 180ms after the last scroll event. The pointer follow
  is now written per second rather than per frame, so the rate decides how often the picture is drawn
  and not how quickly it answers the mouse.
- **A quarter of the pixels.** The backing store is capped at CSS resolution instead of 2x. Nothing on
  this canvas is text: it is soft, low-contrast geometry with hairline strokes, and it survives being
  scaled by the compositor. Compared side by side at `deviceScaleFactor: 2` the facets, hatching and
  strokes are indistinguishable.

The screenshot baselines are unchanged, because Playwright shoots at `deviceScaleFactor: 1`, where
both the old cap and the new one resolve to 1. The change only reaches retina screens — which is
exactly where it was costing four times as much.

Verification: `npx tsc --noEmit`, Prettier and ESLint clean; `npm test` 125 passed, with
`tests/motion.test.ts` extended to cover the three frame rates, the per-second pointer follow and the
resolution cap; `npm run test:e2e` 26 passed; `npm run test:visual` 16 passed with no baseline change.
Local timing remains too noisy to quote — CI is the measurement that counts.

### Sound Removed, and the Section Numbers With It (2026-09-21)

The whole sound feature is gone at the owner's request: the background music, the toggle in the
bottom-right corner, the two confirmation chimes, the footer credit line and the messages behind them.
`src/lib/audio/`, `src/components/ambient-audio.tsx`, `src/styles/audio.css`, `tests/audio.test.ts`,
`docs/background-music.md` and the `audio` bucket migration are deleted, and the two encoded files and
the bucket itself are deleted from Supabase Storage. Nothing on the site plays a sound now.

One thing moved rather than vanished. `styles/audio.css` had taken ownership of `.site-footer`'s bottom
padding, because the floating toggle needed more clearance than the notch inset alone; with the toggle
gone the footer only owes the inset again, so that declaration went back into the inline safe-area
block in the locale layout beside the header's and the skip link's.

**The numbered badges** beside the Experience, Project and Research headings are gone too — the 01/02/03
in a circle, not the headings. The three principles in the hero keep theirs; they are a different
element and were explicitly left alone.

Removing them stranded a whole mechanism. The badge tint was the only consumer of `data-active`, which
`SectionReveal` maintained by running its IntersectionObserver with **nine thresholds** so it could keep
reporting which section was being read as it travelled through the viewport. With nothing left to tint,
all of that was paying for nothing, so the observer now carries one threshold, fires once, writes the
entrance attribute and disconnects. `sectionActive()` and its test went with it.

The grid the badge occupied lost its first column: the three section headings go from
`auto | max-content | 1fr` to `max-content | 1fr`, the desktop projects heading shifts its rule and its
link down one column each, and `--section-content-offset` — 56px, the badge plus its gap, which existed
to align the rows under the heading *text* — is removed along with the two margins that used it. The
content is flush with the heading now because the heading starts at the container edge.

Verification: `npx tsc --noEmit`, Prettier and ESLint clean (0 errors, 16 pre-existing warnings);
`npm test` 111 passed; `npx vitest run` 65 passed; `npm run test:e2e` 26 passed; `npm run test:visual`
16 passed after updating 14 Windows baselines for the missing footer line and the missing badges. **The
Linux set still has to be committed from a CI run.**

### Homepage Below The Fold: Alignment, Rows, Rules, Band, Facets (2026-09-21)

Twelve items the user collected from the live site, done as one pass and verified on a production build.

- **One left edge.** The hero column carried an extra `margin-left` of up to 44px that nothing below it had; removed, so the headline, the principles, every section heading and the closing band now start at the same x (measured 32px at 1900, 700 and 390 wide). The focus-area row may wrap instead of running off narrow screens; no horizontal overflow at any of the three widths. The page ends with `clamp(56px, 9vh, 128px)` before the footer.
- **Education and Experience** are two sections from the same table, split on `kind`; an empty education list leaves no heading behind. Each row starts with a 56px square mark: the organisation's logo from the new `experiences.logo_url` (`supabase/migrations/20260921000100_experience_logo.sql`, additive, optional), or its initial in the same square. The admin editor gains the field with the asset-library picker. No rule under the heading; the first row carries none; dates sit on the content's right edge.
- **Projects** lose most of their lines: no box or dividers around Problem/System/Outcome (a thin gold-tinted top rule per column instead), one faint rule between rows, no underline on the title on hover (the colour still changes). The cursor-following cover preview now sits beside the row, or above it, or not at all; it never covers a row's text.
- **The closing call to action** is a band the width of the column: copy on the left, the download button on the right, 104px tall on desktop; stacked below 640px.
- **Facet headings.** `FacetHeading` cuts each section title into seven diagonal slices that slide into place as the page scrolls it up, with the gold rule and the first row on the same beat (`animation-timeline: view()`, compositor-driven, like depth.css). The range is a scroll distance rather than a share of the viewport, because headings near the end of the page can never reach mid-viewport; Research and the band get shorter distances and still finish. Firefox gets a one-shot entrance; reduced motion gets finished headings. Measured mid-scroll: facet opacities 0.94 to 0 across the seven slices; at the page bottom every slice of the last two headings is at 1.
- **The hero's language carried down** with restraint: page-wide paper grain, a small gold facet at the start of each heading rule, and two large very faint planes behind the lower sections, clipped so they cannot lengthen the page.

Verification:

- `npx tsc --noEmit`: passed. ESLint on the touched files: 0 errors. `npm run format:check`: passed.
- Unit tests, including the rewritten preview-placement cases: passed.
- Production build served locally (real database, then `DEMO_MODE=true` for project rows): alignment, overflow, first-row border, logo squares, date edge, band layout, signal-grid borders, title underline, hover state, preview overlap and page-tail heading opacities all measured with Playwright; screenshots reviewed.
- `20260921000100_experience_logo.sql` is not applied to production yet; rows show initials until it is.

### Contact Redesigned (2026-09-21)

The old page stacked everything in one column: a two-layer heading, a seven-row definition list whose
values sat at a third of the width with the copy buttons pinned to the far right, then a half-width
form. Two thousand pixels tall on a laptop, with an empty band down the middle of every row. The owner
asked for a redesign and supplied the five things worth showing.

- **Two columns from 1024px.** Contact details on the left, the message form on the right; below that
  they stack, details first. The page is now **1013px on desktop against 2034px**, one screen on a
  laptop, and 1712px on a phone.
- **One heading layer.** The `contact-intro` block, its second headline and its duplicate Email button
  are gone — the first row of the list is the address, so a button above it was saying the same thing
  twice. The résumé download moves up beside the title.
- **The copy buttons became icons beside their values.** Five labelled buttons in a column read as the
  loudest thing on the page, and pinning them right is what opened the gap across the middle. They are
  revealed on hover or focus, always visible where there is no hover, and the label survives as the
  accessible name.
- **The values say who, not where.** `describeSocialLink` now lifts the handle out of a GitHub or
  LinkedIn profile URL, so the rows read `Washyu0826` and `kuan-yu-hsien-780123304` rather than
  `github.com` and `linkedin.com/in`. The LinkedIn slug keeps its disambiguating suffix: trimming it
  would name an account that is not this one. A repository URL has two path segments and no handle to
  lift, so it keeps the host.
- **Order and count.** Email, LinkedIn, GitHub, phone, then location — the address last, because it is
  the one row nobody is here to act on. LINE and Instagram are hidden rather than deleted, so they can
  be switched back on in `/admin` without retyping them.
- **The form asks three questions.** The optional subject line is gone: rarely filled, and one more
  thing between a reader and a message. The server still accepts the field and the schema still parses
  it, so nothing behind the form had to change and old drafts still load.

Content, not code: the phone was stored as `tel:+886 0961160826`, which is not a number — `+886`
replaces the trunk `0`, and `contactHref` was stripping the space to produce `+8860961160826`. It is
now `tel:+886 961 160 826`, which displays as written and dials correctly. Location was narrowed to
`台北，台灣` / `Taipei, Taiwan` to match what the owner asked to publish.

Verification: `npx tsc --noEmit`, Prettier and ESLint clean (0 errors, 16 pre-existing warnings);
`npm test` 112 passed, with new cases covering the GitHub, LinkedIn, company and repository display
values; `npx vitest run` 66 passed, the contact-form suite rewritten for three fields; `npm run
test:e2e` 26 passed, including the axe sweep that the hover-revealed copy buttons had to survive;
`npm run test:visual` 16 passed after updating the Windows baselines. **The Linux set still has to be
committed from a CI run.**

### Homepage: One Edge, Plain Titles, One Section Per Wheel (2026-09-22)

Three corrections to the previous pass, decided with the user in five one-at-a-time questions.

- **Alignment, the right way round.** The earlier pass moved the hero column out to the container edge; the user wanted the reverse. The hero keeps its indent (`--column-indent`, 20 to 44px from 768px up) and every section below plus the closing band now takes the same indent, so the whole page shares the hero's left edge (measured 64px for the headline, the principles, each title and the band at 1600 wide).
- **Titles fade in, and again on every stop.** The seven-slice facet headings are gone: they duplicated each title seven times in the DOM, which is what a copy or a screen reader saw, and the stagger read as stutter. A title is one `<h2 class="section-title">` that fades in and rises 12px. `SectionReveal` gains `replay`: the section is marked out again once it has fully left the viewport, so arriving at any section replays its title and rule. Reduced motion shows everything at rest.
- **One section per wheel gesture** (`components/section-stepper.tsx`). Native `scroll-snap-type: mandatory` was tried first and measured: a 260px wheel tick landed nearer the hero than Education and was pulled back to 0 every time, six times out of six, because a mandatory snap goes to the nearest stop, not the next. The stepper takes the wheel on a fine pointer from 768px up, scrolls to the next stop (each section's top 48px under the 77px header; the hero and the page end are stops too), and ignores the wheel for 850ms so a trackpad's coasting cannot fire twice. A section taller than the viewport scrolls natively until its far edge is on screen, so no row is unreachable. Touch, keyboard and reduced motion are left alone (reduced motion jumps instead of gliding). Measured: wheel 1 lands Education's title at 125px from the top, wheel 2 Experience's at 125px; inside the tall Experience list three ticks scroll natively; the next tick reaches the next stop.

Verification:

- `npx tsc --noEmit`, ESLint on the touched files and `npm run format:check`: clean.
- Production build served with demo content; Playwright wheel events and scroll traces for the stops, the title replay (out at 0, in at 718 with opacity 0 to 1, out again after leaving, mid-fade 0.44 on return) and the left edges; screenshot of a stop reviewed.

### Homepage: Symmetric Gutters, One Arrival Beat, A Visible Mark (2026-09-22)

- **Symmetric gutters.** The indent that aligns the page with the hero column was on the left only, so the right gutter was 26 to 44px narrower. Both sides now take `--column-indent`: measured 70/70 at 1920, 64/64 at 1600, 59/59 at 1366.
- **The headline sits a little higher**, lifted off the centre line by `--hero-lift`, and still below the top of the head in the portrait beside it at every width (1600: headline top 186, head top 162, measured by diffing a screenshot against one with the portrait hidden).
- **The rotator loses its 01 02 03 row and the rule under the body** (that rule was the stacked panels' inherited hover hairline). Three small facets carry the foot of the block instead, and the number became the button: it pauses and resumes, which is the stop that auto-advancing content owes a keyboard user now that the step buttons are gone.
- **The four section headings are one layout again.** The gold facet added last pass was auto-placed into column 2, which pushed the rule onto a second row under the title in Education and Experience while Project, which names its columns, kept it alongside. All four now name the same four columns: title, facet, rule, optional link. Project's link is `More` with no count, right-aligned to the same gutter.
- **One arrival beat per section**, replacing the scroll-driven row tilt on the homepage: the title turns up 70 degrees on its horizontal axis over 0.6s, each logo square turns after it 90ms apart, the gold rule and its facet draw out from the title at 360ms, and the rows fade up under them. Measured at Education: title 0.10 to 1.00 over 700ms, logos from 420ms, rule scaleX 0.37 to 1.00, rows 0.32 to 0.99. `depth.css` keeps the tilt for the articles list, which is an ordinary scrolling page.
- **Research is its own stop.** Its stop used to clamp to the page end and merge with it; a `min-height: 62svh` gives it room. Traced with wheel events: Education, Experience, native scrolling through the tall list, Project, Research, then the end.
- **The wheel no longer feels stuck.** The stepper released after a fixed 850ms, leaving dead time after the glide landed; it now releases on `scrollend` plus 140ms, with the fixed lock as the fallback where that event is missing.
- **The brand mark is drawn inline** from the shared path with `currentColor`, so it is near-white on the dark theme instead of nearly invisible, near-black on the light one, and gold on hover, which the CSS had been asking for since it was a PNG. **Favicons are declared**: they existed on disk and in the web manifest but nothing declared them for the document, so tabs showed the browser's globe. Both SVGs are offered, dark and a new light one, by `prefers-color-scheme`.

Verification: `npx tsc --noEmit`, ESLint on the touched files, `npm run format:check` and the unit tests all pass. Everything above was measured on a production build served locally with Playwright, and the screenshots reviewed.

Outstanding: the school crests. `experiences.logo_url` and the admin field are ready, but `20260921000100_experience_logo.sql` is not applied to production, so the squares still show initials.

### Listing Pages: Wider, With The Gutters Put To Work (2026-09-22)

Projects and Notes are lists of wide rows, so they now use a 1320px column instead of the 1120px reading width the other pages keep, and the gutter that opens up carries the hero's vocabulary without repeating it: two tall narrow facets, one leaning each way, outside the column and behind everything.

They appear only from 1560px, where the gutter is genuinely wide enough to hold them. `overflow-x: clip` on `body` is not a safety net for this: with `html` at visible overflow the browser propagates body's overflow to the viewport, so body stops clipping, which is how the first attempt leaked 44px of horizontal scroll at 1440. Measured after the fix: no horizontal overflow at 1920, 1680, 1440 or 1280, and the facets are absent below 1560.

Verification: `npm run format:check`, ESLint and `npx tsc --noEmit` pass; measured and screenshotted on a production build with demo content.

### The Mark In Two Inks, A Rescued Descender, A Backdrop For The Listings (2026-09-22)

- **The brand mark is the original artwork again.** The previous pass replaced the PNG with an inline SVG drawn from the shared stroke path, which changed the drawing; that was not what was asked for. `brand-logo-header.png` is back, untouched, as the light-theme mark, and `brand-logo-header-light.png` is the same file with its ink replaced and its alpha kept, so the dark-theme mark is the same drawing rather than a redrawing of it. CSS picks one, because the theme is a class on `<html>` that the server cannot know at render time. The first attempt at that switch showed both: `.brand-mark-pair img` outranked `.brand-mark-light`, so the rule hiding it never applied.
- **Tab icons come from the same artwork**, not the stroke path: one on paper, one in white on ink, chosen by `prefers-color-scheme`. They were declared for the first time here; the files had been on disk and in the web manifest, but nothing told the document about them, so tabs showed the browser's globe.
- **The headline stopped losing the tail of its 'g'.** `clip-path: inset(0 …)` clips to the inline-block's border box, and with `line-height: 1.08` that box stops above the font's descender, so the finished typewriter animation cut it off. Every typewriter clip now opens `-0.3em` at the bottom, which leaves the left-to-right reveal untouched. Only visible on a first visit, where the animation actually runs. The letter-reveal mask got the same treatment.
- **The rotator closes on the same hairline it opens with.** The three facets at its foot are gone; a second `.enter-rule` sits under it, so both lines are the same element with the same colour, weight and entrance rather than a near match.
- **Projects and Notes have a backdrop of their own**: six leaning planes drawn in CSS, clear at both gutters and masked out across the middle third so no row is read through them, drifting with the scroll at different rates on `animation-timeline: view()`. Static under reduced motion, absent below 1100px. Measured: six planes, no horizontal overflow at 1920, 1440 or 1024.

Verification: `npx tsc --noEmit`, ESLint, `npm run format:check` pass; measured and screenshotted on a production build with demo content, and the theme switch checked in both themes.

### A Cubist Plate In Each Gutter, And A Contact Card That Leads With A Person (2026-09-23)

- **The listing gutters are drawn on now.** The six gradient planes that stood there were so faint
  they read as nothing, which is what the sides looked like: empty. Each gutter holds a tall plate
  built the way the hero's backdrop is - a rectangle cut seventeen times from a fixed seed into
  interlocking facets, construction lines running past the shapes they describe, four arcs swung
  from centres off the plate, hatching across some of the receding planes - but emitted as SVG from
  the server rather than painted on a canvas, because two more canvases would double the most
  expensive thing the site does per frame. Four things move and none of them touch the main thread
  for long: three depth layers slide at different rates on a view timeline, each facet breathes on
  its own 16 to 30 second cycle, the construction lines draw themselves in and out, and a band of
  light crosses once a minute. `lib/facet-plate.ts` is the geometry, `components/listing-facets.tsx`
  the markup, and both are pure, so the drawing is identical on the server and the client.
- Three things had to be got right to keep it out of the way. The timeline is read off the container
  that spans the listing, not off the plate, because the plate is stuck to the viewport and a
  timeline taken from it would barely advance. The gutter is computed from `100vw` and the column's
  own width rather than a percentage, because a percentage inside a custom property resolves against
  whichever element reads it, which by then is the wrong box. And the container clips and fades at
  its foot: the plate is a viewport tall, so without that it ran on past the end of the page and
  reappeared under the footer. Measured: no horizontal overflow at 1920, 1600, 1440, 1280 or 1100,
  288px of plate at 1920 and 128px at 1600, and nothing at all below 1480 where the gutter closes up.
- **The contact card leads with a person.** Name first, then where that person is, then how to reach
  them: a stranger wants to know whose page this is before any of the rest is worth acting on. The
  labels are gone and the icons that carried them are half again as large, with the label kept as the
  tooltip and as text for a screen reader, so the column of words the eye had to read past is now one
  icon wide at every screen size. A name written as "Kuan-Yu Hsien (Zenobia)" splits: the page shows
  both, the JSON-LD carries the first as `name` and the second as `alternateName`.
- **LINE has its own mark.** The speech bubble standing in for it was lucide's generic one, which
  named no service in particular; it is now LINE's balloon, drawn in the same outline weight as the
  icons beside it.
- **No rule above an empty list.** The sentence that stands in for an empty Experience or Project
  list carried the border that belongs to the top of a list, which read as a table with nothing in it.

Verification: the unit suite (117 tests, including a new one asserting the facets tile the plate
exactly and the split-name rules), `npx tsc --noEmit`, ESLint and `npm run format:check` all pass;
measured and screenshotted on a production build in both themes. A stale assertion in
`tests/motion.test.ts`, left behind when `SectionReveal` gained `replay`, was updated to the current
contract rather than deleted.

### The Gutters Lose Their Seam, The Middle Gains A Line, The Hero Is Measured Again (2026-09-23)

The plates in the listing gutters were read as two panels bolted onto the page rather than as one
picture. Five decisions, taken with the owner one at a time:

- **The fade has no edge in it.** It used to hold full strength to 52% of the plate and then drop,
  and that step was the seam. It now loses strength the whole way in and reaches nothing exactly at
  the column's edge, so there is no line anywhere for the eye to catch.
- **Line work crosses the middle.** Lines and arcs only, never a filled plane: a pixel-wide stroke
  can run behind a column of text without any row being read through a tint. Cut on the same angles
  as the plates, so the two gutters read as one picture with the page in the middle of it. Static,
  by choice - nothing moves behind a line being read.
- **The drawing starts above the heading.** The plate is pinned to the viewport, so its top band is
  always the one beside the page's title. The top fade that used to eat it is gone and the
  composition is weighted into it: a facet up there is likelier to be a foreground plane and carries
  more pigment either way, thinning out towards the foot.
- Scope is unchanged: Projects and Notes, nothing else.

On the homepage, four measurements rather than four guesses:

- **The rotator sits between its two rules.** The block is as tall as the longest principle so it
  never resizes as they turn, and all of that slack used to sit at the foot: 22px of air over the
  words, 50 under them. The slack is split above and below now, the number is centred with the text,
  and the marker stopped spanning a second row that has been empty since the beads were removed and
  whose row-gap was still being counted. The body column also widened to 54ch, which puts the
  longest principle back on two lines, so all three panels are the same height and there is no slack
  left to split. Measured on the rendered glyphs: 26px above, 21px below, the same on every panel.
  The closing rule sits a little closer on purpose - equal measures read as bottom-heavy under a line
  with descenders in it.
- **The focus list sits the same distance over its rule as the status line sits under the one above**
  it: 23px and 23px, measured the same way. It was 36.
- **The headline is a shade larger and its left edge is where the small type's is.** At this size the
  blank the font leaves to the left of an S is 2px wide, enough to read as an indent against
  everything under it; a negative margin of its own side bearing takes it out. It still opens below
  the top of the head in the portrait beside it, with 36px to spare.
- The empty-list sentence lost the rule above it, and the résumé button is title case.

Verification: 118 unit tests including the new line-work assertions, `npx tsc --noEmit`, ESLint and
`npm run format:check` pass. Every number above was read off a pixel scan of a production build,
not off the boxes: font metrics put the bottom of a line of text about 10px lower than the ink
actually reaches, which is exactly the size of the error being chased here. No horizontal overflow
at 1920, 1600, 1440, 1280, 1024, 768 or 390 on the homepage or either listing.

### Uploads Went To A Door That Was Never Open (2026-09-23)

The asset library had never carried a file. Both crests stopped at "待重試" with a progress bar at
95%, and `asset_versions.last_error` said `OBJECT_NOT_AVAILABLE`: the server looked in Storage after
the transfer and found nothing there.

The upload went to Storage's resumable (TUS) endpoint with the token from `createSignedUploadUrl` in
an `x-signature` header. Storage answers that with **`Invalid Compact JWS`**. Sending the same token
as `Authorization: Bearer` instead gets further and then fails on `new row violates row-level
security policy` - that endpoint wants a real user's JWT and a policy on `storage.objects`, and this
bucket has no such policy on purpose, because nothing but the server is meant to reach into it. The
progress bar was telling the truth about bytes leaving the browser and nothing about where they
landed; tus-js-client reports progress on a request whose response is a 400.

Signed upload URLs take a single `PUT`, which was verified against the live project before anything
was changed: `PUT <signedUrl>` returns 200 and the object downloads back at the right size. So the
transport is now one PUT, sent with `XMLHttpRequest` because it is still the only way to read upload
progress in a browser - `fetch` cannot report how much of a request body has gone out. `upsert` is
true on both the URL and the header so that pressing retry overwrites whatever a failed attempt left
behind; the object path carries the version's own id, so it can collide with nothing else, and
`finishAssetUpload` re-reads and re-hashes the bytes afterwards whatever they are. Resumability was
worth little here: an asset is 8 MiB at most. `tus-js-client` is gone from the dependencies.

Verification: the Playwright asset harness uploads a 7 MiB file and asserts it reaches Storage in one
PUT carrying the signed token, and never through the admin API; 118 unit tests, `npx tsc --noEmit`,
ESLint and `npm run format:check` pass; and the signed-URL PUT, the overwrite-on-retry path and the
download-back were each exercised against the live project.

### A Curtain Over The Site While It Is Still Being Written (2026-09-28)

The domain went live before the content was finished, and the site was wide open: `/robots.txt` and
`/sitemap.xml` both answered 404 through the catch-all route, and no page carried a `noindex`. A
half-written page that gets crawled is expensive to take back, because the index keeps it long after
the page has been rewritten.

`SITE_LOCKED=true` now answers every public page with 503 and a holding note, and `robots.txt`
refuses everything. 503 rather than 404 or 401: it is the status that means "not yet", so a crawler
comes back later instead of recording that the page is missing. The response is never cached, or the
curtain would outlive the decision to draw it.

Three things stay open behind it. `/admin` and its API, because the point of the curtain is to keep
writing. Share links, because each one was handed to somebody for a particular file. And whoever has
`SITE_UNLOCK`, who trades it once through `?unlock=` for a cookie and then browses normally; with no
secret configured, nobody gets past, including the owner. It is a curtain, not a lock - the secret
travels in a query string - and the thing between a stranger and the admin is still Supabase Auth.

`robots.txt` is read per request rather than baked into the build, so a redeploy that reuses a cached
build cannot leave it saying the opposite of the curtain.

Verification: six unit tests over the decision itself, and the built site measured on both settings.
Locked: `/`, `/en` and `/zh/projects` answer 503, `/admin/login` answers 200, `robots.txt` says
`Disallow: /`, `?unlock=` with the right secret redirects and sets the cookie, the cookie then gets
200, and a wrong secret still gets 503. Unlocked: every page answers 200 and `robots.txt` allows the
site again. 124 unit tests, `npx tsc --noEmit` and `npm run format:check` pass.

Still missing: there is no `sitemap.xml` either, and the README claims both. Worth building before
the curtain lifts.
