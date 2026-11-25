# Blackrock · Analyst Tower

An analyst-tower PWA (repo name `bullpen` kept for the URL). Ask about any stock, ETF or coin ("should I look at Palantir?", `PLTR`, `BTC`) and a team of small analyst bots reports from real data, each from its own floor of an isometric cutaway tower, then they ride the lift to the penthouse where the Boss gives a scored verdict. Live at **https://wajeehk.github.io/bullpen/**.

Unrelated to BlackRock, Inc.; the name and the obsidian-monolith icon are this app's own.

**Not financial advice.** Every number comes from a public source. The write-ups are rule-based templates filled with those numbers (no language-model API, no keys in this public repo). Anything missing is shown as unavailable, never guessed.

## The team
| Analyst | Covers | Data |
| --- | --- | --- |
| Chartist | Trend vs 50/200-day averages, golden/death crosses, RSI 14, MACD 12/26/9, support and resistance from swing pivots, 52-week range, interactive chart | Yahoo Finance daily bars (Actions build) · Kraken daily candles for coins (live) |
| Accountant | TTM revenue and growth, latest-quarter growth, margins, free cash flow, cash vs debt, P/E and P/S vs industry peers, analyst targets, next earnings, EPS beat record | SEC EDGAR XBRL company facts · Nasdaq screener (peer groups) · Nasdaq earnings calendar · Nasdaq analyst data via Ticker's `analysis.json` |
| Crypto Desk (coins) | Market cap, rank, volume, circulating/total/max supply, FDV overhang, ATH drawdown, perp funding, BTC/ETH dominance, Fear & Greed | CoinGecko · OKX funding (live) with Kraken Futures fallback · alternative.me |
| Reporter | Headlines with article images and links, keyword headline tone, dated catalysts | Bing News RSS (Actions build) · Yahoo search news for on-demand tickers |
| Insider | Congress, executive, SEC Form 4 insider and 13F fund trades | The Insider House (`WajeehK/congress-trades`) `trades-all.json`, split per ticker by the Action, plus its `stock/{T}.json` holders |
| Quant (level 2) | Volatility, max drawdown, best/worst day, beta and correlation vs S&P 500 or BTC, relative strength | Same price data |
| Macro (level 3) | SPY vs 200-day, BTC trend, CNN Fear & Greed, GBP/USD | Ticker's `market_sentiment.json` · Yahoo FX |
| Earnings (level 6, stocks) | Next report date and timing, EPS forecast, last four EPS results vs consensus. Context only, not scored (the Accountant already scores the beat record) | Nasdaq earnings calendar · Nasdaq data via Ticker |
| Bear | Collects every risk and bearish signal from the others | — |
| Boss | Score = 50 + 50 × weighted mean of all signals (each −1..+1). Confidence = (0.55 × |net| + 0.45 × weight agreeing) × coverage. The full signal table is in the verdict. | — |

Estimated dates (earnings from the usual quarterly cadence, dividends from past ex-dates) are labelled "estimated". Token unlock schedules have no free feed, so they are marked unavailable and issued-vs-max supply is used as the proxy.

## The tower
Floors: Lobby (your desk, sofa), Research (Chartist, Quant), Fundamentals (Accountant, Crypto Desk), Newsroom (Reporter, Macro), Vault & Risk (Insider, Bear), Trading floor (Earnings bot, trading desk) and the Penthouse with the verdict table. Drag or pinch to pan and zoom, tap the floor rail to jump; the camera follows whoever is presenting. Bots type at their desks, wander to windows, chat, and sit on the lobby sofa between analyses. Landscape shows the wide view with the Waiting on me panel docked right.

**Tower level**: points for each analysis (+40, +20 new ticker, +30 first today), each call (+15) and each scored call (+60 right at 7 days, +120 right at 30 days, +10 otherwise). Levels open the Quant, Macro desk, better screens, the Trading floor, the Earnings bot, the lobby lounge, a penthouse upgrade, the rooftop garden and an art wall.

**Waiting on me**: watchlist moves over 5% (a bot rides the lift down to your desk with a "Needs you" tag), calls due or scored, and finished analyses, each with Open, Make call and Dismiss. **Calls**: bullish or bearish on any ticker, scored automatically at 7 and 30 days against real daily closes, with accuracy and a personal leaderboard (all in `localStorage`). Sound is off by default. Motion respects `prefers-reduced-motion`.

## Data build
`.github/workflows/pages.yml` runs `pipeline/build.py` every 30 minutes (and on push), then deploys the site and the fresh `data/` to GitHub Pages with a retry on `deploy-pages`. Data is not committed. Slow sources keep rolling state in `data/state/*.json`, restored from the live site each run: SEC facts refresh daily, news every 3 h for index names (12 h for the rest), the earnings calendar daily.

Universe: Ticker's instruments list (S&P 500, Nasdaq-100, FTSE 100, curated ETFs) plus every US stock above $1.5B market cap from Nasdaq's screener, plus the top 250 coins. Other symbols are fetched on demand through the public `r.jina.ai` reader (price and news only; it can rate-limit).

Local: `LIMIT=25 python3 pipeline/build.py && python3 -m http.server` (LIMIT builds a small subset).

Release: bump `BUILD` in `js/app.js`, `V` in `sw.js` and the `?v=` strings.
