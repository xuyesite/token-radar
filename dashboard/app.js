// Launch Radar dashboard. All numbers on this page are derived here from
// the model in data.js (the comps curve, the cohort odds, the momentum
// tilt), so the page can never disagree with board.json: same inputs,
// same arithmetic, same order.
(function () {
  var D = window.BOARD_DATA;
  var M = D.model;
  var WL = new Set(D.watchlist);
  var GAS = D.gas;

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(x, digits) { return (x * 100).toFixed(digits === undefined ? 1 : digits) + '%'; }
  function fmtAge(age) {
    if (age === null || age === undefined) return '\u2014';
    if (age < 365) return age + 'd';
    return (age / 365).toFixed(1) + 'y';
  }
  function fmtChg(c) {
    if (c === null || c === undefined) return '<span class="mut">\u2014</span>';
    var cls = c >= 0 ? 'pos' : 'neg';
    return '<span class="' + cls + '">' + (c >= 0 ? '+' : '') + c.toFixed(1) + '%</span>';
  }
  function gasUsd(chain) { return GAS[chain] !== undefined ? GAS[chain] : 0.5; }
  function bridgeUsd(chain) {
    if (chain === 'Ethereum') return 6.0;
    if (chain === 'Solana' || chain === 'Base') return 0.5;
    return 1.0;
  }
  function moneyShort(n) { return '$' + (Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, '')); }
  function numShort(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, ''); }

  // One row, with the model applied. Mirrors main.ts exactly.
  function derive(r) {
    var tvl = r[4];
    var implied = Math.exp(M.comps.a + M.comps.b * Math.log(tvl));
    var mult = r[10];
    var odds = r[7];
    return { implied: implied, mult: mult, expected: implied * odds * mult };
  }

  // Rows in board order (expected value, descending), with rank attached.
  var rows = D.rows.map(function (r, i) {
    var d = derive(r);
    return {
      slug: r[0], name: r[1], cat: D.categories[r[2]],
      chains: r[3].map(function (ci) { return D.chains[ci]; }),
      tvl: r[4], chg: r[5], age: r[6], odds: r[7],
      tpl: r[8], size: r[9],
      implied: d.implied, mult: d.mult, expected: d.expected,
      rank: i + 1, watchlist: WL.has(r[0]),
    };
  });

  // ---- integrity strip and odds table ----
  $('meta-line').textContent =
    M.ranked + ' pre-token protocols ranked \u00b7 ' + M.watchlist_covered + '/' + M.watchlist_total +
    ' watchlist covered \u00b7 snapshot ' + M.as_of + ' \u00b7 ' + M.snapshot_protocols + ' protocols in the snapshot';
  $('stat-comps').textContent = 'log mcap = ' + M.comps.a.toFixed(2) + ' + ' + M.comps.b.toFixed(2) + ' \u00b7 log TVL';
  $('stat-comps-d').textContent = 'Fitted on ' + M.comps.n + ' token protocols in this snapshot.';
  $('stat-r2').textContent = 'R\u00b2 ' + M.comps.r2.toFixed(2);
  $('stat-r2-d').textContent = 'TVL explains ~' + Math.round(M.comps.r2 * 100) + '% of log market cap; typical error \u00d7' + Math.exp(M.comps.loo_rmse_log).toFixed(1) + '.';
  $('stat-wf').textContent = 'RMSE ' + M.comps.walk_forward_rmse_log.toFixed(2) + ' log';
  $('stat-wf-d').textContent = 'Walk-forward on ' + M.comps.walk_forward_n_test + ' newer tokens; bias +' + M.comps.walk_forward_bias_log.toFixed(2) + ' (newer tokens run hot).';
  $('stat-odds').textContent = pct(M.odds.overall_rate) + ' base rate';
  $('stat-odds-d').textContent = 'Split-half Brier ' + M.odds.split_half_brier.toFixed(3) + ' vs ' + M.odds.split_half_base_brier.toFixed(3) + ' for the constant base rate. Lower is better.';
  $('stat-cov').textContent = M.watchlist_covered + '/' + M.watchlist_total;
  $('stat-cov-d').textContent = 'Watchlist protocols covered \u00b7 ' + M.ranked + ' ranked in total.';

  var otb = document.querySelector('#odds-table tbody');
  M.odds.buckets.forEach(function (b) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + b.label + '</td><td>' + b.n + '</td><td>' + b.launched + '</td><td>' + pct(b.rate) + '</td>';
    otb.appendChild(tr);
  });

  // ---- controls ----
  var catSel = $('cat'), chainSel = $('chain');
  D.categories.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  D.chains.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o);
  });

  var state = { q: '', cat: '', chain: '', sort: 'expected', wl: false };

  function filtered() {
    var list = rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.cat && r.cat !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    list.sort(function (a, b) {
      if (key === 'implied') return b.implied - a.implied;
      if (key === 'tvl') return b.tvl - a.tvl;
      if (key === 'odds') return b.odds - a.odds;
      if (key === 'age') return (b.age || 0) - (a.age || 0);
      return b.expected - a.expected;
    });
    return list;
  }

  function render() {
    var list = filtered();
    var tb = document.querySelector('#board tbody');
    tb.innerHTML = '';
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      if (selected && selected.slug === r.slug) tr.className = 'sel';
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name">' + escapeHtml(r.name) + (r.watchlist ? ' <span class="wl-dot" title="On the watchlist">\u25cf</span>' : '') + '</td>' +
        '<td>' + escapeHtml(r.cat) + '</td>' +
        '<td class="mut">' + escapeHtml(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl) + '</td>' +
        '<td class="num">' + fmtChg(r.chg) + '</td>' +
        '<td class="num">' + fmtAge(r.age) + '</td>' +
        '<td class="num">' + pct(r.odds) + '</td>' +
        '<td class="num">' + money(r.implied) + '</td>' +
        '<td class="num"><b>' + money(r.expected) + '</b></td>';
      tr.addEventListener('click', function () { openDetail(r); });
      tb.appendChild(tr);
    });
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' protocols';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- detail view ----
  var selected = null;
  function fill(step, vars) {
    return step.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : '{' + k + '}'; });
  }
  function openDetail(r) {
    selected = r;
    var chain = r.chains[0] || 'Ethereum';
    var tpl = D.templates[r.tpl];
    var vars = {
      name: r.name, chain: chain, size: moneyShort(r.size),
      gas: numShort(gasUsd(chain)), bridge: numShort(bridgeUsd(chain)),
      weeks: String(M.farm_weeks),
    };
    var steps = tpl[1].map(function (s) { return fill(s, vars); });
    var cost = bridgeUsd(chain) + tpl[2] * gasUsd(chain);
    var hours = tpl[3] / 60;
    var be = (cost / r.expected) * 100;
    var bucket = null;
    if (r.age !== null) {
      var idx = r.age < 180 ? 0 : r.age < 365 ? 1 : r.age < 730 ? 2 : r.age < 1095 ? 3 : 4;
      bucket = M.odds.buckets[idx];
    }
    var catRow = null;
    M.odds.categories.forEach(function (c) { if (c.category === r.cat) catRow = c; });
    var el = $('detail');
    el.hidden = false;
    el.innerHTML =
      '<button class="close" id="detail-close">Close</button>' +
      '<h2>#' + r.rank + ' ' + escapeHtml(r.name) + (r.watchlist ? '<span class="tag">ON THE WATCHLIST</span>' : '') + '</h2>' +
      '<p class="dmeta">' + escapeHtml(r.cat) + ' \u00b7 ' + escapeHtml(r.chains.join(', ')) + ' \u00b7 TVL ' + moneyFull(r.tvl) +
      ' \u00b7 listed ' + (r.age === null ? 'date unknown' : fmtAge(r.age) + ' ago') + '</p>' +
      '<div class="breakdown">' +
      '<div class="bd"><div class="k">COMPS-IMPLIED VALUE</div><div class="v">' + money(r.implied) + '</div><div class="d">From the curve: TVL ' + money(r.tvl) + ' \u2192 exp(' + M.comps.a.toFixed(2) + ' + ' + M.comps.b.toFixed(2) + ' \u00b7 ln TVL).</div></div>' +
      '<div class="bd"><div class="k">LAUNCH ODDS</div><div class="v">' + pct(r.odds) + '</div><div class="d">' +
        (bucket ? 'Age bucket ' + bucket.label + ' launches at ' + pct(bucket.rate) + ', shrunk to ' + pct(bucket.shrunk_rate) + ' toward the base rate; ' : '') +
        (catRow ? r.cat + ' launches at ' + pct(catRow.rate) + ' (' + catRow.n + ' protocols), effect shrunk 80% toward none.' : '') + '</div></div>' +
      '<div class="bd"><div class="k">MOMENTUM TILT</div><div class="v">\u00d7' + r.mult.toFixed(2) + '</div><div class="d">' +
        (r.chg === null ? 'No 7-day change recorded; no tilt.' :
          '7-day change ' + (r.chg >= 0 ? '+' : '') + r.chg.toFixed(1) + '% ranks at the ' + Math.round(((r.mult - 0.8) / 0.4) * 100) + 'th percentile of ' + M.growth.n + '; the field\u2019s scale is wild (median |' + M.growth.median_abs_change_pct.toFixed(0) + '%|), so the board uses rank, not size; tilt capped at \u00b120%.') + '</div></div>' +
      '<div class="bd"><div class="k">EXPECTED VALUE</div><div class="v">' + money(r.expected) + '</div><div class="d">Implied \u00d7 odds \u00d7 tilt. A prior, not a price target.</div></div>' +
      '</div>' +
      '<h3>FARM PLAN \u2014 ' + M.farm_weeks + ' WEEKS, ' + escapeHtml(tpl[0]) + ' TEMPLATE</h3>' +
      '<ol class="farm">' + steps.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="verdict">Costed verdict: about <b>' + moneyShort(Math.round(cost * 100) / 100) + ' in gas and bridge fees</b> and <b>~' + hours.toFixed(1) + ' hours</b> over ' + M.farm_weeks +
      ' weeks. That breaks even if your share of a future token is worth at least <b>' + be.toFixed(5) + '% of the implied value</b> (' + moneyFull(cost) + ' of ' + money(r.expected) +
      '). Costs are rough network estimates, not quotes; nothing here promises an airdrop.</p>';
    $('detail-close').addEventListener('click', function () { el.hidden = true; selected = null; render(); });
    render();
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  // ---- events ----
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  catSel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('wl').addEventListener('change', function (e) { state.wl = e.target.checked; render(); });

  // ---- hash routing (lets a screenshot open a filtered or detail view) ----
  function applyHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'cat' && v) { state.cat = v; catSel.value = v; }
      if (k === 'chain' && v) { state.chain = v; chainSel.value = v; }
      if (k === 'sort' && v) { state.sort = v; $('sort').value = v; }
      if (k === 'q' && v) { state.q = v; $('q').value = v; }
      if (k === 'wl' && v === '1') { state.wl = true; $('wl').checked = true; }
      if (k === 'view' && v === 'method') {
        setTimeout(function () { document.getElementById('method').scrollIntoView(); }, 50);
      }
      if (k === 'view' && v === 'table') {
        setTimeout(function () { document.querySelector('.tablewrap').scrollIntoView(); }, 50);
      }
      if (k === 'detail' && v) {
        var r = null;
        rows.forEach(function (x) { if (x.slug === v) r = x; });
        if (r) setTimeout(function () { openDetail(r); }, 50);
      }
    });
  }

  applyHash();
  render();
})();
