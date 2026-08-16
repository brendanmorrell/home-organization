// Manual E2E: auto-growing textareas in quicktodo/quicktodo.html (desktop app source).
//
// ⚠ MANUAL-RUN ONLY — do NOT wire into CI. This opens the real app HTML, which
// talks to the shared production Supabase DB. It creates ZZTEST-pw items and
// deletes them again at the end, but a crash mid-run can leave test items behind.
//
// Requires a Playwright install with Chromium. Default path points at the gstack
// skill's node_modules; override with PLAYWRIGHT_MJS=/path/to/playwright/index.mjs.
//
// Usage: node scripts/e2e/verify-quicktodo-autogrow.mjs quicktodo/quicktodo.html [screenshot.png]
const pwPath =
  process.env.PLAYWRIGHT_MJS ??
  '/Users/brendanmorrell/.claude/skills/gstack/node_modules/playwright/index.mjs';
const { chromium } = await import(pwPath);

const FILE = new URL(process.argv[2], `file://${process.cwd()}/`).pathname;
const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 520 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`file://${FILE}`);

// Identity picker → Brendan
await page.locator('.identity-picker-btn', { hasText: 'Brendan' }).click();
await page.waitForSelector('#newItemInput', { state: 'visible' });
await page.waitForTimeout(2500); // let Supabase sync load lists

const H = (sel) => page.locator(sel).evaluate((el) => el.offsetHeight);

// ── 1. Main add input: no jiggle on first keystroke, grows with content, clamps at 200px
const h0 = await H('#newItemInput');
await page.fill('#newItemInput', 'x');
const h1 = await H('#newItemInput');
ok('main: no height jiggle on first char', Math.abs(h1 - h0) <= 1, `${h0}px -> ${h1}px`);
const LONG = 'This long task text should wrap over and over inside the narrow 360px window until the box is several lines tall. '.repeat(4);
await page.fill('#newItemInput', LONG);
const h2 = await H('#newItemInput');
ok('main: grows with long text', h2 > h0 * 2, `${h0}px -> ${h2}px`);
await page.fill('#newItemInput', LONG.repeat(8));
const h3 = await H('#newItemInput');
ok('main: clamps at max-height 200', h3 === 200, `${h3}px`);

// ── 2. Enter commits a test item and input collapses back
await page.fill('#newItemInput', 'ZZTEST-pw autogrow item with enough words that the inline edit box must wrap across at least three visual lines when opened inside this narrow window for editing');
await page.press('#newItemInput', 'Enter');
await page.waitForTimeout(800);
const h4 = await H('#newItemInput');
ok('main: collapses after Enter commit', Math.abs(h4 - h0) <= 1, `${h4}px (baseline ${h0}px)`);
const row = page.locator('.todo-item', { hasText: 'ZZTEST-pw' }).first();
ok('main: Enter created the item', (await row.count()) === 1, '');

// ── 3. Double-click edit: textarea opens sized to full content and grows further
await row.locator('.todo-text').dblclick();
const edit = page.locator('.todo-edit-input');
await edit.waitFor({ state: 'visible' });
const eh0 = await edit.evaluate((el) => el.offsetHeight);
ok('edit: opens multi-line for long text', eh0 > 40, `${eh0}px`);
await edit.evaluate((el) => { el.value += ' plus some appended text to make it even longer than before so the box must grow taller still while typing continues'; el.dispatchEvent(new Event('input', { bubbles: true })); });
const eh1 = await edit.evaluate((el) => el.offsetHeight);
ok('edit: grows while typing', eh1 > eh0, `${eh0}px -> ${eh1}px`);
await edit.press('Escape');
await page.waitForTimeout(300);

// ── 4. Subtask input grows
const row2 = page.locator('.todo-item', { hasText: 'ZZTEST-pw' }).first();
await row2.hover();
await row2.locator('.add-sub-btn').click();
const sub = page.locator('.subtask-edit-input');
await sub.waitFor({ state: 'visible' });
const sh0 = await sub.evaluate((el) => el.offsetHeight);
await sub.fill('subtask text that also needs to wrap across multiple lines in the narrow window to prove the subtask input grows vertically too');
const sh1 = await sub.evaluate((el) => el.offsetHeight);
ok('subtask: grows with long text', sh1 > sh0 * 1.8, `${sh0}px -> ${sh1}px`);
await sub.press('Escape');
await page.waitForTimeout(300);

// ── 5. Tab rename textarea grows (dblclick active tab name)
const activeTabName = page.locator('.tab-bar .tab.active, .tab-bar [class*="tab"][class*="active"]').first();
if (await activeTabName.count()) {
  await activeTabName.dblclick();
  const ren = page.locator('.tab-rename-input');
  if (await ren.count()) {
    const rh0 = await ren.evaluate((el) => el.offsetHeight);
    await ren.evaluate((el) => { el.value = 'A very long list name to wrap'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const rh1 = await ren.evaluate((el) => el.offsetHeight);
    ok('rename: grows with long name', rh1 > rh0, `${rh0}px -> ${rh1}px`);
    await ren.press('Escape');
    await page.waitForTimeout(300);
  } else {
    ok('rename: input appeared', false, 'no .tab-rename-input after dblclick');
  }
} else {
  console.log('SKIP rename: no active tab element matched');
}

// ── 6. Cleanup: delete every ZZTEST item
for (const marker of ['ZZTEST-pw', 'ZZTEST']) {
  for (let i = 0; i < 5; i++) {
    const r = page.locator('.todo-item', { hasText: marker }).first();
    if (!(await r.count())) break;
    await r.hover();
    await r.locator('.todo-delete').click();
    await page.waitForTimeout(500);
  }
}
const leftover = await page.locator('.todo-item', { hasText: 'ZZTEST' }).count();
ok('cleanup: all ZZTEST items removed', leftover === 0, `${leftover} left`);
await page.waitForTimeout(1000); // let deletes sync

if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `\n${failed.length} FAILURES` : '\nALL PASS');
process.exit(failed.length ? 1 : 0);
