import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('scripts/shots', { recursive: true });

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--window-size=1500,950'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:8766', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1500);

// Check initial state
const initial = await p.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  label: document.querySelector('button[aria-label*="mode"]')?.getAttribute('aria-label'),
  bg: getComputedStyle(document.body).backgroundColor,
}));
console.log('Initial:', JSON.stringify(initial));
await p.screenshot({ path: 'scripts/shots/dark-01-initial.png' });

// Click toggle (find by any aria-label containing "mode")
await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label*="mode"]');
  if (btn) btn.click();
});
await sleep(600);

const after1 = await p.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  label: document.querySelector('button[aria-label*="mode"]')?.getAttribute('aria-label'),
  bg: getComputedStyle(document.body).backgroundColor,
}));
console.log('After toggle:', JSON.stringify(after1));
await p.screenshot({ path: 'scripts/shots/dark-02-toggled.png' });

// Toggle again
await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label*="mode"]');
  if (btn) btn.click();
});
await sleep(600);

const after2 = await p.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  label: document.querySelector('button[aria-label*="mode"]')?.getAttribute('aria-label'),
  bg: getComputedStyle(document.body).backgroundColor,
  stored: localStorage.getItem('etfbuilder-theme'),
}));
console.log('After 2nd toggle:', JSON.stringify(after2));
await p.screenshot({ path: 'scripts/shots/dark-03-toggled-back.png' });

// Reload to test persistence
await p.reload({ waitUntil: 'networkidle2' });
await sleep(1200);
const persisted = await p.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  bg: getComputedStyle(document.body).backgroundColor,
  stored: localStorage.getItem('etfbuilder-theme'),
}));
console.log('After reload:', JSON.stringify(persisted));
await p.screenshot({ path: 'scripts/shots/dark-04-persisted.png' });

await b.close();
