# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/xuyesite/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/xuyesite/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar: 198 pre-token DeFi protocols from the 14 Nov 2026 DeFiLlama snapshot, ranked by expected launch value. The value is three honest pieces multiplied together: a comps-implied value fitted on the snapshot itself (log market cap on log TVL over the 128 protocols that already have a token), launch odds from the snapshot's own cohort record (age-bucket rates shrunk toward the overall rate, category effect shrunk 80% toward none — the shrunk odds beat the constant base rate out of sample, split-half Brier 0.135 vs 0.141), and a rank-based momentum tilt on the 7-day change (top of the ranking +20%, bottom −20%; the field's scale is not trusted — median absolute value 879% — so only its rank is used). Every protocol gets a concrete farm plan with a cost in gas and bridge fees, hours over 8 weeks, and the break-even share of the implied value. The dashboard is a sortable, filterable page with a detail view per protocol; it derives every number from the same model, so the page and the board can never disagree.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Node 22+, standard library only. Reads the competition snapshot, writes `out/board.json` (198 rows), `out/dashboard/` (the page and its data), `out/screenshots/` (rendered from the dashboard), and `out/dossier.json` (the dossier the judge reads). Run it twice and every output byte is identical.

---

<sub>Entered on [make.fun](https://make.fun/?ref=75k23xv8&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
