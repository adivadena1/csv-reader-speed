# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/adivadena1/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/adivadena1/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, written for the make.fun bounty
"Read broken CSV files faster".

`solve.js` exports `run(input)`, which answers `{text, header}` with
`{columns, rows, errors}` exactly as csv-reader 1.0.0 does — same broken-row
policy (stray CRs, unterminated quotes, quote junk, short and long rows),
same error records — but scanned in a single pass with plain fields taken as
slices of the input instead of one character at a time.

`main.ts` is the driver: it reads every case from `/input/cases.json`,
answers each with `run`, and writes `/output/answers.json`.

- ES module, no dependencies, no network, no randomness
- Deterministic: two runs write byte-identical output
- Node 22

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=3txr3dna&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
