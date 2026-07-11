import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:5174';
const OUT = 'scripts/shots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--window-size=1500,950'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0,200)); });
page.on('pageerror', e => errors.push('pageerror: ' + (e.message||'').slice(0,200)));

async function clickByText(tag, text) {
  const handle = await page.evaluateHandle((tag, text) => {
    const els = [...document.querySelectorAll(tag)];
    return els.find(e => e.textContent.trim().toLowerCase().includes(text.toLowerCase())) || null;
  }, tag, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1200);
await page.screenshot({ path: `${OUT}/01-empty.png` });

const SEARCH_SEL = 'input[type="text"], input[type="search"], input:not([type])';
async function addTicker(t) {
  const inp = await page.$(SEARCH_SEL);
  if (inp) {
    await inp.click();
    await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await inp.type(t);
    await sleep(900);
  }
  const added = await clickByText('button', '+ Add') || await clickByText('button', 'Add');
  await sleep(600);
  return added;
}
console.log('add VOO', await addTicker('VOO'));
console.log('add BND', await addTicker('BND'));
console.log('add QQQ', await addTicker('QQQ'));
// clear search so results list is full again behind the portfolio
const inp2 = await page.$(SEARCH_SEL);
if (inp2) { await inp2.click(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await sleep(600); }
await sleep(400);
console.log('equal weight', await clickByText('button', 'Equal weight'));
await sleep(1800);
await page.screenshot({ path: `${OUT}/02-built.png` });
await page.screenshot({ path: `${OUT}/02-built-full.png`, fullPage: true });

// drag a slider to change a weight, confirm donut reflows
const slider = await page.$('input[type="range"]');
if (slider) { await slider.focus(); for (let i=0;i<20;i++){ await page.keyboard.press('ArrowUp'); } await sleep(1200); }
await page.screenshot({ path: `${OUT}/02b-reweighted.png` });

// open a profile: click a screener row's ticker cell (IVV — not in portfolio)
const opened = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')];
  const cell = els.find(e => e.children.length === 0 && e.textContent.trim() === 'IVV');
  let row = cell; while (row && !(row.getAttribute('role')==='button' || row.tagName==='TR' || /row/i.test(row.className||''))) row = row.parentElement;
  (row || cell)?.click(); return !!cell;
});
console.log('profile open click', opened);
await sleep(1400);
await page.screenshot({ path: `${OUT}/03-profile.png` });

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 1) : 'none');
await browser.close();
