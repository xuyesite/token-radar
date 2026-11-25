import { readFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-board.ts';
import { createHash } from 'node:crypto';

const out = 'out';
const snap = JSON.parse(readFileSync('../token-radar-01-kit/input/snapshot.json', 'utf8'));
const board = JSON.parse(readFileSync(`${out}/board.json`, 'utf8'));
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

// --- board checks ---
ok(board.schema === 'makefun/board/v1', 'schema');
ok(board.title.length <= 200 && !/xuyesite|token-radar/i.test(board.title), 'title clean, len ' + board.title.length);
ok(board.board.length >= 100 && board.board.length <= 4000, 'board rows ' + board.board.length);
const wl = new Set(snap.watchlist);
ok(wl.size === 40 && [...wl].every(s => board.board.some(r => r.slug === s)), 'watchlist 40/40');
ok(board.board.every((r, i) => r.rank === i + 1), 'ranks 1..N');
ok(board.board.every((r, i, a) => i === 0 || r.implied_value_usd <= a[i-1].implied_value_usd), 'implied non-rising');
const slugs = new Set(snap.protocols.map(p => p.slug));
ok(board.board.every(r => slugs.has(r.slug)), 'slugs in snapshot');
ok(board.board.every(r => Number.isInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 1e14), 'implied range');
ok(board.board.every(r => r.farm_steps.length >= 3 && r.farm_steps.length <= 12 && r.farm_steps.every(s => s.length >= 20 && s.length <= 600)), 'farm steps 3-12, 20-600 chars');
const sha = createHash('sha256').update(readFileSync('../token-radar-01-kit/input/snapshot.json')).digest('hex');
ok(board.snapshot.sha256 === sha, 'snapshot sha256');
ok(board.snapshot.as_of === '2026-11-14' && board.snapshot.protocols === 758, 'snapshot meta');

// --- dashboard checks ---
import { readdirSync, statSync } from 'node:fs';
for (const f of readdirSync(`${out}/dashboard`)) {
  const p = `${out}/dashboard/${f}`;
  ok(statSync(p).size < 4 * 1024 * 1024, `dashboard/${f} < 4MiB`);
  if (/\.(html|css|js)$/.test(f)) {
    const t = readFileSync(p, 'utf8');
    ok(!/https?:\/\//.test(t), `dashboard/${f} has no http/https`);
  }
}
const shots = readdirSync(`${out}/screenshots`).sort();
ok(shots.length >= 3 && shots.length <= 4, 'screenshots count ' + shots.length);
for (const f of shots) {
  const sz = statSync(`${out}/screenshots/${f}`).size;
  ok(sz <= 512 * 1024, `screenshot ${f} ${Math.round(sz/1024)}KiB <= 512KiB`);
}

// --- dossier matches ---
const rebuilt = buildDossier(out, { text_max_bytes: 65536 });
const onDisk = readFileSync(`${out}/dossier.json`);
ok(Buffer.from(rebuilt).equals(onDisk), 'dossier.json == buildDossier(out)');
ok(onDisk.length <= 1.5 * 1024 * 1024, 'dossier <= 1.5MiB: ' + onDisk.length);
const doc = JSON.parse(onDisk.toString('utf8'));
ok(doc.schema === 'makefun/dossier/v1' && doc.cover === 0 && doc.images.length === 4, 'dossier schema/cover/images');
ok(doc.text.length <= 65536, 'dossier text <= 65536: ' + doc.text.length);
ok(doc.text.includes('### index.html') && doc.text.includes('### app.js') && doc.text.includes('### app.css') && doc.text.includes('### data.js'), 'dossier shows all 4 dashboard files whole (no cut line: ' + !/Cut at/.test(doc.text) + ')');

// --- page vs board agreement: recompute from data.js exactly like app.js ---
const window = {};
const dataJs = readFileSync(`${out}/dashboard/data.js`, 'utf8');
eval(dataJs);
const D = window.BOARD_DATA;
const M = D.model;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
let mismatch = 0;
D.rows.forEach((r, i) => {
  const b = board.board[i];
  const implied = Math.exp(M.comps.a + M.comps.b * Math.log(r[4]));
  const mult = r[10];
  const expected = Math.round(implied * r[7] * mult);
  if (b.slug !== r[0] || b.comps_implied_usd !== Math.max(1, Math.round(implied)) || b.implied_value_usd !== expected || b.launch_odds !== r[7] || b.growth_mult !== mult) mismatch++;
});
ok(mismatch === 0, 'page-derived implied/expected/odds match board.json for all rows');
// farm steps rendered from data.js templates match board.json
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
const gasOf = c => D.gas[c] ?? 0.5;
const bridgeOf = c => c === 'Ethereum' ? 6 : (c === 'Solana' || c === 'Base') ? 0.5 : 1;
const num = n => n.toFixed(2).replace(/\.00$/, '');
const money = n => '$' + num(n);
let stepMismatch = 0;
D.rows.forEach((r, i) => {
  const chain = D.chains[r[3][0]];
  const tpl = D.templates[r[8]];
  const vars = { name: r[1], chain, size: money(r[9]), gas: num(gasOf(chain)), bridge: num(bridgeOf(chain)), weeks: String(M.farm_weeks) };
  const steps = tpl[1].map(s => fill(s, vars));
  if (JSON.stringify(steps) !== JSON.stringify(board.board[i].farm_steps)) stepMismatch++;
});
ok(stepMismatch === 0, 'page-rendered farm steps match board.json for all rows');
console.log(fail === 0 ? 'ALL CHECKS PASS' : `${fail} CHECKS FAILED`);
process.exit(fail === 0 ? 0 : 1);
