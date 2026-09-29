import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const themeLabel = { zh: '切換主題', en: 'Change theme' } as const;
const paper = { light: [247, 246, 241], dark: [13, 14, 16] } as const;
// The daylight tint mixes a few percent of warmth into the page colour, so the computed value is a
// color-mix result rather than the token verbatim. Compare by distance: a wrong theme is hundreds of
// levels away, the tint is single digits.
async function expectPaper(page: Page, scheme: 'light' | 'dark') {
  await expect(async () => {
    const rgb = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const parts = rgb.startsWith('color(')
      ? rgb.replace(/^color\(srgb\s*/, '').replace(/\).*$/, '').trim().split(/\s+/).map(v => Number(v) * 255)
      : (rgb.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    expect(parts).toHaveLength(3);
    parts.forEach((value, index) => expect(Math.abs(value - paper[scheme][index])).toBeLessThan(16));
  }).toPass({ timeout: 15000 });
}
// The default theme is a fixed `dark`; light is opted into through the theme <select>.
async function chooseTheme(page: Page, locale: 'zh' | 'en', theme: 'light' | 'dark') {
  const select = page.getByRole('combobox', { name: themeLabel[locale] });
  await expect(select).not.toHaveValue('system');
  // The select is in the HTML before React attaches its handler, so a selection made during
  // hydration is swallowed and the class never lands. On a loaded CI runner that window is wide
  // enough to fail the run. Keep choosing until it takes.
  await expect(async () => {
    await select.selectOption(theme);
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
}
for (const locale of ['zh', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const path of ['', '/projects', '/projects/document-search', '/contact']) {
    test(`${locale} / ${colorScheme} / ${path || 'home'}: mobile layout and accessibility`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(`/${locale}${path}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-TW' : 'en');
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveClass(/dark/);
        if (colorScheme === 'light') await chooseTheme(page, locale, 'light');
        await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /dark/ : /light/);
        await expectPaper(page, colorScheme);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(result.violations).toEqual([]);
    });
    }
  }
}
test('filters use URL and preserve the current route and filter across language switch', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/zh/projects');
  await page.locator('.filter-list a').filter({ hasText: '資料／AI' }).click();
  await expect(page).toHaveURL(/tag=data-ai/);
  await expect(page.locator('.project-row')).toHaveCount(2);
  await page.getByRole('link', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/projects\?tag=data-ai/);
  await expect(page.locator('.project-row')).toHaveCount(2);
});
test('mobile menu traps focus, closes with Escape and returns focus to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/zh');
  const trigger = page.getByRole('button', { name: '開啟選單' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('image lightbox supports keyboard dismissal and restores focus', async ({ page }) => {
  await page.goto('/en/projects/document-search');
  const trigger = page.getByRole('button', { name: /Enlarge image/ }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
test('404, resume PDF and Accept-Language negotiation have usable destinations', async ({ page, request }) => {
  const response = await request.get('/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, maxRedirects: 0 });
  expect(response.headers().location).toMatch(/\/en$/);
  const missing = await page.goto('/en/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("This file isn't here.");
  const resume = await request.get('/resume/en.pdf', { maxRedirects: 0 });
  expect(resume.status()).toBe(307);
  expect(resume.headers().location).toMatch(/\/resumes\/kuan-yu-hsien-resume-en\.pdf$/);
  const unknown = await request.get('/resume/xx.pdf', { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
for (const [locale, navLabel] of [['zh', '文章'], ['en', 'Notes']] as const) {
  test(`${locale}: articles index renders translated heading and navigation link`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}/articles`, { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toContainText('Articles.title');
    await expect(page.getByRole('navigation').getByRole('link', { name: navLabel, exact: true })).toBeVisible();
  });
}
test('admin pages redirect to the login screen when signed out', async ({ page }) => {
  for (const path of ['/admin', '/admin/files']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/login/);
  }
});
test('contact page exposes a form with a submit button', async ({ page }) => {
  await page.goto('/zh/contact', { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').first();
  await expect(form).toBeVisible();
  await expect(form.getByRole('button', { name: /送出|傳送|Send|Submit/ })).toBeVisible();
});

test('command palette opens with the keyboard, filters and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/zh');
  await page.keyboard.press('Control+k');
  const panel = page.locator('.command-panel');
  await expect(panel).toBeVisible();
  await panel.locator('.command-input').fill('data');
  await expect(panel.locator('.command-item')).not.toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/zh\/projects\//);
  await page.keyboard.press('Control+k');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

/** How far a heading is tipped, read back off its own matrix: the (2,3) entry of a rotateX is sin(angle). */
async function tiltOf(page: Page, selector: string) {
  return page.evaluate(css => {
    const element = document.querySelector<HTMLElement>(css);
    if (!element) return null;
    const style = getComputedStyle(element);
    const parts = style.transform.startsWith('matrix3d')
      ? style.transform.slice(9, -1).split(',').map(Number)
      : null;
    return {
      opacity: Number(style.opacity),
      // matrix3d is column-major; m[6] is the term rotateX writes.
      tilt: parts ? Math.round((Math.asin(Math.min(1, Math.abs(parts[6]))) * 180) / Math.PI) : 0,
    };
  }, selector);
}

/**
 * The homepage plays one arrival beat per section rather than tilting each row with the scroll.
 *
 * This test used to read the scroll-driven tilt off `.project-row` on the projects list. That effect
 * moved: the homepage now stops one section at a time, so a per-row tilt on top of it read as two
 * things moving at once, and `depth.css` keeps the scroll-driven version for `.article-row` alone -
 * a list demo mode has none of, which is what CI builds. So the thing to hold onto is the beat that
 * actually ships: components/section-reveal.tsx writes `data-enter` on the way in and, with
 * `replay`, on the way out again, and facets.css turns the title up on its horizontal axis from it.
 */
test('a section title turns up as the page arrives at it, and lies back down once it has left', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 812 });
  // The beat is declared behind prefers-reduced-motion, and the default for the rest of this file
  // asks for `reduce`. This is the one test that wants it running.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/zh', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);

  const section = page.locator('.experience-section').first();
  await expect(section).toHaveCount(1);
  const title = '.experience-section .section-title';

  // Put the section well below the fold and it is waiting: tipped back, and invisible rather than
  // faint, so nothing half-drawn is ever read.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(section).toHaveAttribute('data-enter', 'out', { timeout: 5000 });
  const waiting = await tiltOf(page, title);
  expect(waiting).not.toBeNull();
  expect(waiting!.tilt).toBeGreaterThan(40);
  expect(waiting!.opacity).toBeLessThan(0.1);

  // Bring it onto the screen and the beat plays: upright and solid when it settles.
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-enter', 'in', { timeout: 5000 });
  await page.waitForTimeout(900);
  const arrived = await tiltOf(page, title);
  expect(arrived!.tilt).toBe(0);
  expect(arrived!.opacity).toBeGreaterThan(0.99);

  // And it goes back to waiting once the page has left it, so stepping back plays the beat again
  // instead of finding the section already standing.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(section).toHaveAttribute('data-enter', 'out', { timeout: 5000 });
  const again = await tiltOf(page, title);
  expect(again!.tilt).toBeGreaterThan(40);
});
