# Bullpen

A pixel-art trading floor PWA. Ask about any stock, ETF or coin ("should I look at Palantir?", `PLTR`, `BTC`) and a team of pixel analysts walks to the table and reports from real data, then the Boss gives a scored verdict. Live at **https://wajeehk.github.io/bullpen/**.

**Not financial advice.** Every number comes from a public source. The write-ups are rule-based templates filled with those numbers (no language-model API, no keys in this public repo). Anything missing is shown as unavailable, never guessed.

## The team
| Analyst | Covers | Data |
| --- | --- | --- |
| Chartist | Trend vs 50/200-day averages, golden/death crosses, RSI 14, MACD 12/26/9, support and resistance from swing pivots, 52-week range, interactive chart | Yahoo Finance daily bars (Actions build) · Kraken daily candles for coins (live) |
| Accountant | TTM revenue and growth, latest-quarter growth, margins, free cash flow, cash vs debt, P/E and P/S vs industry peers, analyst targets, next earnings, EPS beat record | SEC EDGAR XBRL company facts · Nasdaq screener (peer groups) · Nasdaq earnings calendar · Nasdaq analyst data via Ticker's `analysis.json` |
| Crypto Desk (coins) | Market cap, rank, volume, circulating/total/max supply, FDV overhang, ATH drawdown, perp funding, BTC/ETH dominance, Fear & Greed | CoinGecko · OKX funding (live) with Kraken Futures fallback · alternative.me |
| Reporter | Headlines with article images and links, keyword headline tone, dated catalysts | Bing News RSS (Actions build) · Yahoo search news for on-demand tickers |
| Insider | Congress, executive, SEC Form 4 insider and 13F fund trades | The Insider House (`WajeehK/congress-trades`) `trades-all.json`, split per ticker by the Action, plus its `stock/{T}.json` holders |
| Quant (Lv 2) | Volatility, max drawdown, best/worst day, beta and correlation vs S&P 500 or BTC, relative strength | Same price data |
| Macro (Lv 3) | SPY vs 200-day, BTC trend, CNN Fear & Greed, GBP/USD | Ticker's `market_sentiment.json` · Yahoo FX |
| The Bear | Collects every risk and bearish signal from the others | — |
| The Boss | Score = 50 + 50 × weighted mean of all signals (each −1..+1). Confidence = (0.55 × |net| + 0.45 × weight agreeing) × coverage. The full signal table is in the verdict. | — |

Estimated dates (earnings from the usual quarterly cadence, dividends from past ex-dates) are labelled "estimated". Token unlock schedules have no free feed, so they are marked unavailable and issued-vs-max supply is used as the proxy.

## Game layer
XP per analysis (+ bonuses for a new ticker and the first analysis of the day), levels that unlock the Quant, Macro desk and office décor. **Calls**: bull or bear on any ticker from the verdict card, scored automatically at 7 and 30 days against real daily closes, with accuracy and a personal leaderboard (all in `localStorage`). **Watchlist**: while the app is open, an analyst walks over and taps you when a holding moves more than 5% in a day. Sound effects are off by default.

## Data build
`.github/workflows/pages.yml` runs `pipeline/build.py` every 30 minutes (and on push), then deploys the site and the fresh `data/` to GitHub Pages with a retry on `deploy-pages`. Data is not committed. Slow sources keep rolling state in `data/state/*.json`, restored from the live site each run: SEC facts refresh daily, news every 3 h for index names (12 h for the rest), the earnings calendar daily.

Universe: Ticker's instruments list (S&P 500, Nasdaq-100, FTSE 100, curated ETFs) plus every US stock above $1.5B market cap from Nasdaq's screener, plus the top 250 coins. Other symbols are fetched on demand through the public `r.jina.ai` reader (price and news only; it can rate-limit).

Local: `LIMIT=25 python3 pipeline/build.py && python3 -m http.server` (LIMIT builds a small subset).

Release: bump `BUILD` in `js/app.js`, `V` in `sw.js` and the `?v=` strings.
