// Manual E2E: auto-growing textareas in the /todos PWA route (app/routes/todos.tsx).
//
// ⚠ MANUAL-RUN ONLY — do NOT wire into CI. This drives a real dev server, which
// talks to the shared production Supabase DB. It creates ZZTEST-pwa items and
// deletes them again at the end, but a crash mid-run can leave test items behind.
//
// Requires a Playwright install with Chromium. Default path points at the gstack
// skill's node_modules; override with PLAYWRIGHT_MJS=/path/to/playwright/index.mjs.
//
// Usage: npm run dev  # then:
//        node scripts/e2e/verify-todos-pwa-autogrow.mjs http://localhost:5173/todos [screenshot.png]
const pwPath =
  process.env.PLAYWRIGHT_MJS ??
  '/Users/brendanmorrell/.claude/skills/gstack/node_modules/playwright/index.mjs';
const { chromium } = await import(pwPath);

const URL = process.argv[2] || 'http://localhost:5173/todos';
const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(URL);

// Identity picker → Brendan. Retry the click: React may not have hydrated yet on the first attempt.
await page.waitForTimeout(2000);
const picker = page.locator('.identity-picker-btn', { hasText: 'Brendan' });
for (let i = 0; i < 5 && (await picker.count()); i++) {
  await picker.click();
  await page.waitForTimeout(1500);
}
await page.waitForSelector('.todo-input', { state: 'visible', timeout: 20000 });
await page.waitForTimeout(2500); // let Supabase load

const H = (sel) => page.locator(sel).evaluate((el) => el.offsetHeight);

// ── 1. Main add input
const h0 = await H('.todo-input');
await page.fill('.todo-input', 'x');
const h1 = await H('.todo-input');
ok('main: no height jiggle on first char', Math.abs(h1 - h0) <= 1, `${h0}px -> ${h1}px`);
const LONG = 'This long task text should wrap over and over inside the narrow phone-width window until the box is several lines tall. '.repeat(4);
await page.fill('.todo-input', LONG);
const h2 = await H('.todo-input');
ok('main: grows with long text', h2 > h0 * 2, `${h0}px -> ${h2}px`);

// textarea must inherit the app font, not default monospace
const fam = await page.locator('.todo-input').evaluate((el) => getComputedStyle(el).fontFamily);
ok('main: font-family inherited (not monospace)', !/monospace/i.test(fam), fam.slice(0, 60));

// ── 2. Enter commits, input collapses
await page.fill('.todo-input', 'ZZTEST-pwa autogrow item with enough words that the inline edit box must wrap across at least three visual lines when opened for editing in a phone width viewport');
await page.press('.todo-input', 'Enter');
await page.waitForTimeout(1200);
const h4 = await H('.todo-input');
ok('main: collapses after Enter commit', Math.abs(h4 - h0) <= 1, `${h4}px (baseline ${h0}px)`);
const row = page.locator('.todo-item', { hasText: 'ZZTEST-pwa' }).first();
ok('main: Enter created the item', (await row.count()) === 1, '');

// ── 3. Double-click edit
await row.locator('.todo-item-text').dblclick();
const edit = page.locator('.todo-item-edit');
await edit.waitFor({ state: 'visible' });
const eh0 = await edit.evaluate((el) => el.offsetHeight);
ok('edit: opens multi-line for long text', eh0 > 50, `${eh0}px`);
await edit.pressSequentially(' plus extra words typed one by one to force the box to keep growing taller while typing continues here', { delay: 2 });
const eh1 = await edit.evaluate((el) => el.offsetHeight);
ok('edit: grows while typing', eh1 > eh0, `${eh0}px -> ${eh1}px`);
await edit.press('Escape');
await page.waitForTimeout(300);

// ── 4. Subtask input grows
const row2 = page.locator('.todo-item', { hasText: 'ZZTEST-pwa' }).first();
await row2.hover();
await row2.locator('.todo-item-addsub').click();
const sub = page.locator('.todo-subtask-input');
await sub.waitFor({ state: 'visible' });
const sh0 = await sub.evaluate((el) => el.offsetHeight);
await sub.fill('subtask text that also needs to wrap across multiple lines in the narrow viewport to prove the subtask input grows vertically too');
const sh1 = await sub.evaluate((el) => el.offsetHeight);
ok('subtask: grows with long text', sh1 > sh0 * 1.8, `${sh0}px -> ${sh1}px`);
await sub.press('Escape');
await page.waitForTimeout(300);

// ── 5. Tab rename grows
const activeTab = page.locator('.todo-tab.active .todo-tab-name').first();
if (await activeTab.count()) {
  await activeTab.dblclick();
  const ren = page.locator('.todo-tab-rename');
  await ren.waitFor({ state: 'visible' });
  const rh0 = await ren.evaluate((el) => el.offsetHeight);
  await ren.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, 'A very long list name that wraps');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const rh1 = await ren.evaluate((el) => el.offsetHeight);
  ok('rename: grows with long name', rh1 > rh0, `${rh0}px -> ${rh1}px`);
  await ren.press('Escape');
  await page.waitForTimeout(300);
} else {
  ok('rename: active tab found', false, 'no .todo-tab.active');
}

// ── 6. Cleanup: delete ZZTEST-pwa items
for (let i = 0; i < 5; i++) {
  const r = page.locator('.todo-item', { hasText: 'ZZTEST-pwa' }).first();
  if (!(await r.count())) break;
  await r.hover();
  await r.locator('.todo-item-delete').click();
  await page.waitForTimeout(600);
}
const leftover = await page.locator('.todo-item', { hasText: 'ZZTEST' }).count();
ok('cleanup: all ZZTEST items removed', leftover === 0, `${leftover} left`);
await page.waitForTimeout(1200);

if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `\n${failed.length} FAILURES` : '\nALL PASS');
process.exit(failed.length ? 1 : 0);
