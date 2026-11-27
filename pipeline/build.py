#!/usr/bin/env python3
"""Blackrock (repo: bullpen) data build (GitHub Actions). Real public data only, nothing invented.

Writes ./data:
  search.json            autocomplete universe (stocks, ETFs, crypto)
  q.json                 latest quotes {id: [price, changePct, asOf]}
  s/{ID}.json            per stock/ETF: daily OHLCV (2y), quote, news, fundamentals, peers, earnings, analysts
  c/{SYM}.json           per coin: daily OHLC from Kraken (where listed) + news
  crypto.json            CoinGecko markets (top 250), global dominance, Kraken Futures funding
  ins/{TICKER}.json      congress / executive / insider / fund trades split from The Insider House
  state/*.json           rolling caches restored from the live site so slow sources run at most daily
Env: LIMIT=n to build only n symbols (local testing).
"""
import concurrent.futures as cf
import datetime as dt
import email.utils
import gzip
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
LIVE = os.environ.get("LIVE_BASE", "https://wajeehk.github.io/bullpen/")
TICKER = "https://wajeehk.github.io/ticker/"
IH = "https://wajeehk.github.io/congress-trades/"
UA = "BullpenPWA/1.0 (https://wajeehk.github.io/bullpen/; khurramwajeeh-d0ymqp@mail.grokbot.com)"
CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
SEC_UA = "Bullpen app khurramwajeeh-d0ymqp@mail.grokbot.com"
LIMIT = int(os.environ.get("LIMIT", "0") or 0)
NOW = time.time()
T0 = time.time()
LOG = []
ERR = []

EXTRA = [  # popular names outside the index lists Ticker tracks
    ("RKLB", "Rocket Lab", "Industrials", "Aerospace & Defense"), ("ASTS", "AST SpaceMobile", "Communication Services", "Telecom"),
    ("IONQ", "IonQ", "Information Technology", "Computers"), ("SOFI", "SoFi Technologies", "Financials", "Consumer Finance"),
    ("HOOD", "Robinhood Markets", "Financials", "Capital Markets"), ("MSTR", "Strategy", "Information Technology", "Software"),
    ("COIN", "Coinbase Global", "Financials", "Capital Markets"), ("USAR", "USA Rare Earth", "Materials", "Metals & Mining"),
    ("MP", "MP Materials", "Materials", "Metals & Mining"), ("RIVN", "Rivian Automotive", "Consumer Discretionary", "Automobiles"),
    ("NIO", "NIO", "Consumer Discretionary", "Automobiles"), ("SNOW", "Snowflake", "Information Technology", "Software"),
    ("NET", "Cloudflare", "Information Technology", "Software"), ("SHOP", "Shopify", "Information Technology", "Software"),
    ("RBLX", "Roblox", "Communication Services", "Entertainment"), ("U", "Unity Software", "Information Technology", "Software"),
    ("AFRM", "Affirm", "Financials", "Consumer Finance"), ("UPST", "Upstart", "Financials", "Consumer Finance"),
    ("SMCI", "Super Micro Computer", "Information Technology", "Computers"), ("ARM", "Arm Holdings", "Information Technology", "Semiconductors"),
    ("TSM", "Taiwan Semiconductor", "Information Technology", "Semiconductors"), ("BABA", "Alibaba", "Consumer Discretionary", "Broadline Retail"),
    ("OKLO", "Oklo", "Utilities", "Electric Utilities"), ("SMR", "NuScale Power", "Industrials", "Electrical Equipment"),
    ("RDDT", "Reddit", "Communication Services", "Interactive Media"), ("CRCL", "Circle Internet", "Financials", "Capital Markets"),
    ("ACHR", "Archer Aviation", "Industrials", "Aerospace & Defense"), ("JOBY", "Joby Aviation", "Industrials", "Aerospace & Defense"),
    ("SPOT", "Spotify", "Communication Services", "Entertainment"), ("CLSK", "CleanSpark", "Information Technology", "Software"),
    ("MARA", "MARA Holdings", "Information Technology", "Software"), ("RIOT", "Riot Platforms", "Information Technology", "Software"),
    ("NU", "Nu Holdings", "Financials", "Banks"), ("GME", "GameStop", "Consumer Discretionary", "Specialty Retail"),
    ("AMC", "AMC Entertainment", "Communication Services", "Entertainment"), ("LCID", "Lucid Group", "Consumer Discretionary", "Automobiles"),
    ("BBAI", "BigBear.ai", "Information Technology", "Software"), ("SOUN", "SoundHound AI", "Information Technology", "Software"),
    ("QBTS", "D-Wave Quantum", "Information Technology", "Computers"), ("RGTI", "Rigetti Computing", "Information Technology", "Computers"),
    ("HIMS", "Hims & Hers Health", "Health Care", "Health Care Providers"), ("CELH", "Celsius Holdings", "Consumer Staples", "Beverages"),
]


def log(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s)
    print(f"[{time.time()-T0:6.1f}s]", s, flush=True)


def get(url, headers=None, timeout=25, tries=3, raw=False):
    h = {"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "gzip"}
    h.update(headers or {})
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    b = gzip.decompress(b)
                return b if raw else b.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (404, 400, 401, 403):
                break
            time.sleep(1.5 * (a + 1) + (4 if e.code == 429 else 0))
        except Exception as e:  # noqa
            last = f"{type(e).__name__}"
            time.sleep(1.2 * (a + 1))
    raise RuntimeError(f"{last} {url[:90]}")


def get_json(url, **kw):
    return json.loads(get(url, **kw))


def wjson(path, obj):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)


def restore(name):
    """Rolling state from the live site (or a local copy)."""
    p = os.path.join(OUT, "state", name)
    try:
        return get_json(LIVE + "data/state/" + name + f"?t={int(NOW)}", timeout=40, tries=2)
    except Exception:
        pass
    try:
        return json.load(open(p))
    except Exception:
        return {}


def r4(x, n=4):
    if x is None:
        return None
    try:
        return float(f"{x:.{n}g}") if abs(x) < 1 else round(x, 2 if abs(x) < 1e5 else 0)
    except Exception:
        return None


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- universe
def universe():
    try:
        inst = get_json(TICKER + "data/instruments.json")["instruments"]
        log("universe from Ticker live instruments.json", len(inst))
    except Exception as e:
        inst = json.load(open(os.path.join(ROOT, "pipeline", "universe_seed.json")))
        log("universe from seed", len(inst), e)
    seen = {x["id"] for x in inst}
    for s, n, sec, ind in EXTRA:
        if s not in seen:
            inst.append({"id": s, "symbol": s, "name": n, "kind": "equity", "currency": "USD", "exchange": "US", "sector": sec, "industry": ind})
            seen.add(s)
    # curated ETF / large-cap / LSE / rare-earth additions (each id verified against Yahoo chart data); ids already present are skipped
    try:
        for x in json.load(open(os.path.join(ROOT, "pipeline", "extra_universe.json"))):
            if x["id"] not in seen:
                inst.append(x)
                seen.add(x["id"])
    except Exception as e:
        ERR.append(f"extra_universe.json unreadable: {e}")
    seen = None
    # broaden to every US-listed stock over $1.5B from Nasdaq's public screener, with one consistent sector/industry taxonomy
    try:
        rows = get_json("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true", headers={"User-Agent": CHROME, "Accept": "application/json"}, timeout=60)["data"]["rows"]
        scr = {}
        for r in rows:
            sym = (r.get("symbol") or "").strip().upper().replace("/", "-")
            try:
                mc = float(r.get("marketCap") or 0)
            except ValueError:
                mc = 0
            if not sym or "^" in sym or mc < 1.5e9:
                continue
            nm = re.sub(r"\s+(Class [A-Z] )?(Common Stock|Ordinary Shares|American Depositary Shares|American Depository Shares|Common Shares|Depositary Shares|Sponsored ADR|ADS|Units|Common Units|Shares of Beneficial Interest).*$", "", r.get("name") or sym, flags=re.I).strip(" ,")
            scr[sym] = {"name": nm, "sector": r.get("sector") or None, "industry": r.get("industry") or None, "mcap": mc}
        core = {x["id"] for x in inst}
        for x in inst:
            if x.get("exchange") == "US" and x.get("kind") == "equity" and x["id"] in scr:
                if scr[x["id"]]["industry"]:
                    x["sector"], x["industry"] = scr[x["id"]]["sector"], scr[x["id"]]["industry"]
            x["core"] = True
        for sym, v in sorted(scr.items(), key=lambda kv: -kv[1]["mcap"]):
            if sym not in core:
                inst.append({"id": sym, "symbol": sym, "name": v["name"], "kind": "equity", "currency": "USD", "exchange": "US", "sector": v["sector"], "industry": v["industry"]})
        log("Nasdaq screener added", len(inst) - len(core), "US stocks over $1.5B")
    except Exception as e:
        ERR.append(f"Nasdaq screener failed, index universe only: {e}")
        for x in inst:
            x["core"] = True
    out = []
    for x in inst:
        out.append({k: x.get(k) for k in ("id", "symbol", "name", "kind", "currency", "exchange", "sector", "industry", "issuer", "expenseRatio", "core") if x.get(k) is not None})
    if LIMIT:
        pri = ["LUNR", "PLTR", "NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "SPY", "QQQ", "VUSA.L", "BARC.L", "USAR", "MP", "SOFI", "AVGO", "CRM", "ORCL", "NOW", "SNOW", "ADBE", "INTC", "QCOM", "TXN", "MU"]
        out = [x for x in out if x["id"] in pri][:LIMIT]
    return out


# ---------------------------------------------------------------- prices
CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{s}?range=2y&interval=1d&events=div%2Csplit&includePrePost=false"


def fetch_chart(inst):
    sid = inst["id"]
    d = get_json(CHART.format(s=urllib.parse.quote(sid, safe="")), headers={"Accept": "application/json"}, tries=3)
    res = (d.get("chart") or {}).get("result") or []
    if not res:
        raise RuntimeError("no result")
    r = res[0]
    meta = r.get("meta") or {}
    scale = 0.01 if meta.get("currency") in ("GBp", "GBX") else 1.0
    ts = r.get("timestamp") or []
    q = ((r.get("indicators") or {}).get("quote") or [{}])[0]
    rows = []
    for i, t in enumerate(ts):
        c = (q.get("close") or [None])[i] if i < len(q.get("close") or []) else None
        if c is None:
            continue
        o, h, l, v = (q.get(k)[i] if q.get(k) and i < len(q.get(k)) else None for k in ("open", "high", "low", "volume"))
        f = lambda z: None if z is None else round(z * scale, 4 if z * scale < 10 else 2)
        rows.append([int(t // 86400), f(o) or f(c), f(h) or f(c), f(l) or f(c), f(c), int(v or 0)])
    if len(rows) < 5:
        raise RuntimeError("short history")
    price = meta.get("regularMarketPrice")
    price = round(price * scale, 4) if price else rows[-1][4]
    prev = rows[-2][4] if len(rows) > 1 else None
    # if today's bar is the live one, prev is the bar before; Yahoo's last bar is the current session
    divs = []
    for k, v in ((r.get("events") or {}).get("dividends") or {}).items():
        divs.append([int(v["date"]), round(v["amount"] * scale, 4)])
    divs.sort()
    return {
        "id": sid,
        "cur": "GBP" if scale != 1 else (meta.get("currency") or "USD"),
        "exch": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "longName": meta.get("longName") or meta.get("shortName"),
        "price": price,
        "prev": prev,
        "asOf": int(meta.get("regularMarketTime") or 0),
        "hi52": round((meta.get("fiftyTwoWeekHigh") or 0) * scale, 4) or None,
        "lo52": round((meta.get("fiftyTwoWeekLow") or 0) * scale, 4) or None,
        "d": rows,
        "div": divs[-8:],
        "type": meta.get("instrumentType"),
    }


def run_prices(U):
    out, fails = {}, []
    def job(x):
        time.sleep(0.05)
        return x["id"], fetch_chart(x)
    with cf.ThreadPoolExecutor(2) as ex:
        futs = {ex.submit(job, x): x for x in U}
        for f in cf.as_completed(futs):
            try:
                k, v = f.result()
                out[k] = v
            except Exception as e:
                fails.append(futs[f]["id"])
    log("prices", len(out), "ok,", len(fails), "failed", fails[:15])
    if fails:
        ERR.append(f"Yahoo chart failed for {len(fails)} symbols")
    return out


# ---------------------------------------------------------------- news (Bing News RSS: direct links + article images)
NS = "{https://www.bing.com/news/search}"


def clean_name(n):
    n = re.sub(r"\b(Inc|Incorporated|Corp|Corporation|Co|Company|plc|PLC|Ltd|Limited|Holdings?|Group|N\.?V|S\.?A|Class [A-C]|The)\b\.?,?", "", n or "")
    return re.sub(r"\s+", " ", n).strip(" ,.&")


def bing(query, n=8):
    url = "https://www.bing.com/news/search?" + urllib.parse.urlencode({"q": query, "format": "rss", "setmkt": "en-GB", "qft": "sortbydate=\"1\""})
    txt = get(url, timeout=20, tries=2)
    txt = re.sub(r"xmlns:News=\"[^\"]*\"", 'xmlns:News="https://www.bing.com/news/search"', txt, count=1)
    root = ET.fromstring(txt)
    items = []
    for it in root.iter("item"):
        g = lambda tag: (it.findtext(tag) or "").strip()
        link = g("link")
        m = re.search(r"[?&]url=([^&]+)", link)
        real = urllib.parse.unquote(m.group(1)) if m else link
        img = it.findtext(NS + "Image") or ""
        if img:
            img = img.replace("http://", "https://") + "&w=480&h=270&c=14"
        try:
            ts = int(email.utils.parsedate_to_datetime(g("pubDate")).timestamp())
        except Exception:
            ts = 0
        items.append({"t": html.unescape(g("title")), "u": real, "s": it.findtext(NS + "Source") or urllib.parse.urlparse(real).netloc,
                      "ts": ts, "d": html.unescape(re.sub("<[^>]+>", "", g("description")))[:300], "img": img or None})
    seen, out = set(), []
    for x in sorted(items, key=lambda z: -z["ts"]):
        k = re.sub(r"\W+", "", x["t"].lower())[:50]
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    return out[:n]


def news_query(x):
    if x.get("kind") == "crypto":
        return f"{x['name']} crypto"
    if x.get("kind") == "etf":
        return f"{x['symbol']} ETF"
    nm = clean_name(x.get("name", ""))
    if x.get("exchange") == "LSE":
        return f"\"{nm}\" shares"
    return f"\"{nm}\" {x['symbol']} stock"


def run_news(U, state, budget=420, stale=3 * 3600):
    todo = [x for x in U if NOW - (state.get(x["id"], {}).get("at") or 0) > (stale if x.get("core") else 4 * stale)]
    todo.sort(key=lambda x: (not x.get("core"), state.get(x["id"], {}).get("at") or 0))
    t1, n_ok, n_bad = time.time(), 0, 0
    def job(x):
        return x["id"], bing(news_query(x))
    with cf.ThreadPoolExecutor(4) as ex:
        futs = []
        for x in todo:
            futs.append(ex.submit(job, x))
        for f in cf.as_completed(futs):
            try:
                k, v = f.result()
                if v:
                    state[k] = {"at": int(time.time()), "items": v}
                    n_ok += 1
            except Exception:
                n_bad += 1
            if time.time() - t1 > budget:
                for g in futs:
                    g.cancel()
                break
    log("news refreshed", n_ok, "failed", n_bad, "of", len(todo), "stale")
    return state


# ---------------------------------------------------------------- SEC fundamentals
REV = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense", "InterestAndDividendIncomeOperating"]
TAGS = {
    "ni": ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    "gp": ["GrossProfit"],
    "cogs": ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
    "op": ["OperatingIncomeLoss"],
    "eps": ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "rnd": ["ResearchAndDevelopmentExpense"],
}
INST = {
    "cash": ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"],
    "sti": ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
    "ltd": ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations", "LongTermNotesPayable", "SeniorNotes"],
    "std": ["LongTermDebtCurrent", "DebtCurrent", "ShortTermBorrowings", "CommercialPaper"],
    "eq": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "assets": ["Assets"],
    "liab": ["Liabilities"],
}


def pdate(s):
    return dt.date.fromisoformat(s)


def quarters(units):
    """Quarterly values keyed by period end from 10-Q/10-K duration facts (YTD figures are differenced)."""
    rows = [u for u in units if u.get("start") and u.get("form") in ("10-Q", "10-K", "10-Q/A", "10-K/A", "20-F", "40-F", "6-K")]
    best = {}
    for u in rows:  # latest filing wins for an identical period
        k = (u["start"], u["end"])
        if k not in best or u.get("filed", "") > best[k].get("filed", ""):
            best[k] = u
    direct, bystart = {}, {}
    for (s, e), u in best.items():
        days = (pdate(e) - pdate(s)).days
        if 80 <= days <= 100:
            direct[e] = u["val"]
        bystart.setdefault(s, []).append((e, days, u["val"]))
    derived = {}
    for s, lst in bystart.items():
        lst.sort()
        for i in range(1, len(lst)):
            e0, d0, v0 = lst[i - 1]
            e1, d1, v1 = lst[i]
            if 80 <= (pdate(e1) - pdate(e0)).days <= 100 and d0 >= 80:
                derived.setdefault(e1, v1 - v0)
    q = dict(derived)
    q.update(direct)
    annual = {e: v for (s, e), v in ((k, u["val"]) for k, u in best.items()) if 350 <= (pdate(e) - pdate(s)).days <= 380}
    return dict(sorted(q.items())), dict(sorted(annual.items()))


def ttm(q):
    ks = list(q.keys())
    if len(ks) < 4:
        return None, None
    last4 = ks[-4:]
    if (pdate(last4[-1]) - pdate(last4[0])).days > 300:
        return None, None
    return sum(q[k] for k in last4), last4[-1]


def pick(facts, names, unit="USD"):
    best, bestend = None, ""
    for n in names:
        f = facts.get(n)
        if not f:
            continue
        u = f.get("units", {}).get(unit) or []
        if not u:
            continue
        end = max((x.get("end", "") for x in u), default="")
        if end > bestend:
            best, bestend = u, end
    return best


def fundamentals(cik):
    d = get_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json", headers={"User-Agent": SEC_UA}, timeout=60)
    g = (d.get("facts") or {}).get("us-gaap") or {}
    dei = (d.get("facts") or {}).get("dei") or {}
    out = {"cik": cik, "src": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-Q"}
    ru = pick(g, REV)
    if ru:
        q, a = quarters(ru)
        v, end = ttm(q)
        out["rev_ttm"], out["end"] = v, end
        ks = list(q.keys())
        if len(ks) >= 8 and (pdate(ks[-5]) - pdate(ks[-8])).days < 300:
            out["rev_ttm_prev"] = sum(q[k] for k in ks[-8:-4])
        if len(ks) >= 5:
            last = ks[-1]
            yago = [k for k in ks if 350 <= (pdate(last) - pdate(k)).days <= 380]
            if yago:
                out["rev_q_yoy"] = (q[last] / q[yago[-1]] - 1) if q[yago[-1]] else None
        out["rev_q"] = [[k, q[k]] for k in ks[-8:]]
        if not v and a:
            out["rev_fy"], out["end"] = list(a.values())[-1], list(a.keys())[-1]
    for key, names in TAGS.items():
        u = pick(g, names, "USD/shares" if key == "eps" else "USD")
        if not u:
            continue
        q, a = quarters(u)
        v, end = ttm(q)
        if v is not None and (not out.get("end") or end >= out["end"][:7] or True):
            out[key + "_ttm"] = v
        if key in ("ni", "eps"):
            ks = list(q.keys())
            out[key + "_q"] = [[k, q[k]] for k in ks[-8:]]
    for key, names in INST.items():
        u = pick(g, names)
        if not u:
            continue
        u = [x for x in u if x.get("form", "").startswith(("10-", "20-", "40-"))] or u
        last = max(u, key=lambda x: (x.get("end", ""), x.get("filed", "")))
        if out.get("end") and (pdate(out["end"]) - pdate(last["end"])).days > 200:
            continue  # stale tag the company stopped reporting
        out[key] = last["val"]
        out[key + "_at"] = last["end"]
    sh = pick(dei, ["EntityCommonStockSharesOutstanding"], "shares")
    if sh:
        last = max(sh, key=lambda x: (x.get("end", ""), x.get("filed", "")))
        out["shares"], out["shares_at"] = last["val"], last["end"]
        # add other share classes reported on the same date (e.g. GOOGL/GOOG)
        same = [x["val"] for x in sh if x.get("end") == last["end"] and x.get("accn") == last.get("accn")]
        if len(same) > 1:
            out["shares"] = sum(same)
    if not out.get("shares"):
        for tag in ("CommonStockSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"):
            u = (g.get(tag) or {}).get("units", {}).get("shares") or []
            if u:
                last = max(u, key=lambda x: (x.get("end", ""), x.get("filed", "")))
                if not out.get("end") or (pdate(out["end"]) - pdate(last["end"])).days < 200:
                    out["shares"], out["shares_at"], out["shares_src"] = last["val"], last["end"], tag
                    break
    out["filed"] = max((x.get("filed", "") for x in (ru or [])), default=None)
    return out


def run_fund(U, state, budget=600, stale=20 * 3600):
    try:
        tick = get_json("https://www.sec.gov/files/company_tickers.json", headers={"User-Agent": SEC_UA})
        cik = {v["ticker"].upper(): int(v["cik_str"]) for v in tick.values()}
    except Exception as e:
        ERR.append(f"SEC ticker map failed: {e}")
        return state
    todo = [x for x in U if x.get("kind") == "equity" and x.get("exchange") == "US" and NOW - (state.get(x["id"], {}).get("at") or 0) > stale]
    todo.sort(key=lambda x: (not x.get("core"), state.get(x["id"], {}).get("at") or 0))
    t1, ok, bad = time.time(), 0, 0
    def job(x):
        c = cik.get(x["symbol"].upper()) or cik.get(x["symbol"].replace(".", "-").upper()) or cik.get(x["symbol"].replace("-", ".").upper())
        if not c:
            return x["id"], None
        time.sleep(0.25)
        return x["id"], fundamentals(c)
    with cf.ThreadPoolExecutor(3) as ex:
        futs = [ex.submit(job, x) for x in todo]
        for f in cf.as_completed(futs):
            try:
                k, v = f.result()
                state[k] = {"at": int(time.time()), "f": v}
                ok += 1
            except Exception:
                bad += 1
            if time.time() - t1 > budget:
                for g in futs:
                    g.cancel()
                break
    log("SEC fundamentals", ok, "ok", bad, "failed of", len(todo))
    return state


# ---------------------------------------------------------------- earnings calendar (Nasdaq, next ~100 days)
def run_earnings(state, stale=20 * 3600):
    if NOW - (state.get("at") or 0) < stale and state.get("next"):
        return state
    nxt, ok = {}, 0
    today = dt.date.today()
    days = [today + dt.timedelta(days=i) for i in range(0, 100) if (today + dt.timedelta(days=i)).weekday() < 5]
    def job(day):
        d = get_json(f"https://api.nasdaq.com/api/calendar/earnings?date={day.isoformat()}", headers={"User-Agent": CHROME, "Accept": "application/json", "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"}, tries=2)
        rows = ((d.get("data") or {}).get("rows")) or []
        return day, rows
    with cf.ThreadPoolExecutor(4) as ex:
        for f in cf.as_completed([ex.submit(job, d) for d in days]):
            try:
                day, rows = f.result()
                ok += 1
                for r in rows:
                    s = (r.get("symbol") or "").upper()
                    if s and (s not in nxt or day.isoformat() < nxt[s]["date"]):
                        nxt[s] = {"date": day.isoformat(), "time": r.get("time"), "epsF": r.get("epsForecast"), "q": r.get("fiscalQuarterEnding")}
            except Exception:
                pass
    log("Nasdaq earnings calendar days", ok, "symbols", len(nxt))
    if ok < 10:
        ERR.append("Nasdaq earnings calendar mostly failed; kept previous")
        return state
    return {"at": int(NOW), "next": nxt}


# ---------------------------------------------------------------- insider trades (The Insider House)
def run_insider():
    try:
        meta = get_json(IH + "data/meta.json")
        d = get_json(IH + f"data/trades-all.json?v={meta.get('build','')}", timeout=120)
    except Exception as e:
        ERR.append(f"Insider House trades unavailable: {e}")
        return 0
    cols = d["cols"]
    ix = {c: i for i, c in enumerate(cols)}
    keep = ["chamber", "politician", "party", "state", "owner", "side", "tx_type", "tx_date", "disclosure_date", "amount", "amount_low", "amount_high", "url", "est_price", "pct_since", "description", "asset"]
    by = {}
    cutoff = (dt.date.today() - dt.timedelta(days=3 * 365)).isoformat()
    for r in d["rows"]:
        t = (r[ix["ticker"]] or "").upper().strip()
        if not t or (r[ix["tx_date"]] or "") < cutoff:
            continue
        by.setdefault(t, []).append([r[ix[c]] for c in keep])
    n = 0
    for t, rows in by.items():
        if not re.match(r"^[A-Z0-9.\-]{1,10}$", t):
            continue
        rows.sort(key=lambda z: z[7] or "", reverse=True)
        wjson(f"ins/{t}.json", {"cols": keep, "rows": rows[:80], "n": len(rows), "build": meta.get("build"), "src": IH})
        n += 1
    log("insider files", n)
    return n


# ---------------------------------------------------------------- crypto
def run_crypto(news_state):
    out = {"asOf": int(NOW)}
    try:
        m = get_json("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d,30d,1y")
        keepk = ["id", "symbol", "name", "image", "current_price", "market_cap", "market_cap_rank", "fully_diluted_valuation", "total_volume", "circulating_supply", "total_supply", "max_supply", "ath", "ath_change_percentage", "ath_date", "atl", "price_change_percentage_24h", "price_change_percentage_7d_in_currency", "price_change_percentage_30d_in_currency", "price_change_percentage_1y_in_currency", "last_updated"]
        out["coins"] = [{k: c.get(k) for k in keepk} for c in m]
    except Exception as e:
        ERR.append(f"CoinGecko markets failed: {e}")
        out["coins"] = []
    try:
        g = get_json("https://api.coingecko.com/api/v3/global")["data"]
        out["global"] = {"mcap": g["total_market_cap"]["usd"], "vol": g["total_volume"]["usd"], "dom": {k: round(v, 2) for k, v in g["market_cap_percentage"].items()}, "mcapChg24h": g.get("market_cap_change_percentage_24h_usd")}
    except Exception as e:
        ERR.append(f"CoinGecko global failed: {e}")
    try:
        t = get_json("https://futures.kraken.com/derivatives/api/v3/tickers")["tickers"]
        fr = {}
        for x in t:
            if x.get("tag") == "perpetual" and x.get("symbol", "").startswith("PF_") and x.get("fundingRate") is not None and x.get("markPrice"):
                base = x["symbol"][3:].replace("USD", "")
                base = "BTC" if base == "XBT" else base
                # Kraken quotes fundingRate in USD per contract per hour; relative = rate / mark
                fr[base] = {"rel": x.get("fundingRateRelative") if x.get("fundingRateRelative") is not None else x["fundingRate"] / x["markPrice"], "oi": x.get("openInterest"), "mark": x.get("markPrice"), "src": "Kraken Futures"}
        out["funding"] = fr
    except Exception as e:
        ERR.append(f"Kraken futures funding failed: {e}")
    try:
        f = get_json("https://api.alternative.me/fng/?limit=1")["data"][0]
        out["fng"] = {"v": int(f["value"]), "label": f["value_classification"], "ts": int(f["timestamp"])}
    except Exception:
        pass
    # Kraken spot daily OHLC for coins Kraken lists
    try:
        pairs = get_json("https://api.kraken.com/0/public/AssetPairs")["result"]
        kmap = {}
        for k, p in pairs.items():
            ws = p.get("wsname") or ""
            if ws.endswith("/USD"):
                b = ws.split("/")[0]
                b = "BTC" if b == "XBT" else ("DOGE" if b == "XDG" else b)
                kmap[b] = k
        out["kraken"] = kmap
    except Exception as e:
        kmap = {}
        ERR.append(f"Kraken pairs failed: {e}")
    top = out["coins"][: (12 if LIMIT else 120)]
    def hist(c):
        sym = c["symbol"].upper()
        pk = kmap.get(sym)
        if not pk:
            return sym, None
        r = get_json(f"https://api.kraken.com/0/public/OHLC?pair={pk}&interval=1440")["result"]
        rows = next(v for k, v in r.items() if k != "last")
        return sym, [[int(x[0]) // 86400, float(x[1]), float(x[2]), float(x[3]), float(x[4]), round(float(x[6]) * float(x[5]))] for x in rows]
    hs = {}
    with cf.ThreadPoolExecutor(3) as ex:
        for f in cf.as_completed([ex.submit(hist, c) for c in top]):
            try:
                s, h = f.result()
                if h:
                    hs[s] = h
            except Exception:
                pass
    log("crypto coins", len(out["coins"]), "kraken hist", len(hs), "funding", len(out.get("funding", {})))
    # coin news (top 40), 3h stale
    todo = [c for c in top[:40] if NOW - (news_state.get("C:" + c["symbol"].upper(), {}).get("at") or 0) > 3 * 3600]
    def nj(c):
        return c["symbol"].upper(), bing(f"{c['name']} crypto" if c["name"].lower() != c["symbol"].lower() else f"{c['name']} cryptocurrency")
    with cf.ThreadPoolExecutor(4) as ex:
        for f in cf.as_completed([ex.submit(nj, c) for c in todo]):
            try:
                s, v = f.result()
                news_state["C:" + s] = {"at": int(time.time()), "items": v}
            except Exception:
                pass
    for c in top:
        s = c["symbol"].upper()
        wjson(f"c/{s}.json", {"sym": s, "id": c["id"], "d": hs.get(s), "news": (news_state.get("C:" + s) or {}).get("items") or [], "newsAt": (news_state.get("C:" + s) or {}).get("at"), "pair": kmap.get(s)})
    wjson("crypto.json", out)
    return out


# ---------------------------------------------------------------- peers
def median(v):
    v = sorted(x for x in v if x is not None)
    if not v:
        return None
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def metrics(inst, px, f):
    if not f or not px:
        return None
    p = px["price"]
    m = {"id": inst["id"], "name": inst.get("name")}
    if f.get("shares"):
        m["mcap"] = p * f["shares"]
    eps = f.get("eps_ttm")
    m["pe"] = p / eps if eps and eps > 0 else None
    if f.get("rev_ttm") and m.get("mcap"):
        m["ps"] = m["mcap"] / f["rev_ttm"]
    if f.get("rev_ttm"):
        r = f["rev_ttm"]
        gp = f.get("gp_ttm") or ((r - f["cogs_ttm"]) if f.get("cogs_ttm") else None)
        m["gm"] = gp / r if gp is not None else None
        m["om"] = f["op_ttm"] / r if f.get("op_ttm") is not None else None
        m["nm"] = f["ni_ttm"] / r if f.get("ni_ttm") is not None else None
        if f.get("rev_ttm_prev"):
            m["g"] = r / f["rev_ttm_prev"] - 1
    return {k: (r4(v) if isinstance(v, float) else v) for k, v in m.items()}


# ---------------------------------------------------------------- main
def main():
    os.makedirs(OUT, exist_ok=True)
    U = universe()
    news_state = restore("news.json")
    fund_state = restore("fund.json")
    earn_state = restore("earnings.json")
    px = run_prices(U)
    news_state = run_news(U, news_state, budget=60 if LIMIT else 420)
    fund_state = run_fund(U, fund_state, budget=90 if LIMIT else 600)
    earn_state = run_earnings(earn_state)
    try:
        analysts = get_json(TICKER + "data/analysis.json").get("bySymbol") or {}
    except Exception as e:
        analysts = {}
        ERR.append(f"Ticker analysis.json unavailable: {e}")
    n_ins = run_insider()
    crypto = run_crypto(news_state)

    met = {}
    for x in U:
        m = metrics(x, px.get(x["id"]), (fund_state.get(x["id"]) or {}).get("f"))
        if m:
            m["ind"], m["sec"] = x.get("industry"), x.get("sector")
            met[x["id"]] = m
    byind, bysec = {}, {}
    for k, m in met.items():
        byind.setdefault(m.get("ind"), []).append(m)
        bysec.setdefault(m.get("sec"), []).append(m)

    quotes = {}
    for x in U:
        p = px.get(x["id"])
        if not p:
            continue
        chg = (p["price"] / p["prev"] - 1) * 100 if p.get("prev") else None
        quotes[x["id"]] = [p["price"], round(chg, 3) if chg is not None else None, p["asOf"], p["cur"]]
        f = (fund_state.get(x["id"]) or {}).get("f")
        group = (byind.get(x.get("industry")) or []) if x.get("industry") else []
        scope = "industry"
        if len(group) < 4:
            group, scope = (bysec.get(x.get("sector")) or []) if x.get("sector") else [], "sector"
        peers = None
        if met.get(x["id"]) and group:
            others = sorted([g for g in group if g["id"] != x["id"]], key=lambda g: -(g.get("mcap") or 0))
            peers = {"scope": scope, "label": x.get("industry") if scope == "industry" else x.get("sector"), "n": len(others),
                     "med": {k: r4(median([g.get(k) for g in others])) for k in ("pe", "ps", "gm", "om", "nm", "g")},
                     "top": others[:6]}
        a = analysts.get(x["id"]) or analysts.get(x["symbol"])
        if a:
            a = {k: a.get(k) for k in ("asOf", "targets", "consensus", "earningsHistory", "lastEarnings", "source", "ratingChanges")}
        e = (earn_state.get("next") or {}).get(x["symbol"].upper()) if x.get("exchange") == "US" else None
        ns = news_state.get(x["id"]) or {}
        wjson(f"s/{x['id']}.json", {
            "id": x["id"], "sym": x["symbol"], "name": x.get("name") or p.get("longName"), "kind": x.get("kind"), "ex": x.get("exchange"),
            "sector": x.get("sector"), "industry": x.get("industry"), "issuer": x.get("issuer"), "er": x.get("expenseRatio"),
            "cur": p["cur"], "exch": p.get("exch"), "price": p["price"], "prev": p.get("prev"), "asOf": p["asOf"], "hi52": p.get("hi52"), "lo52": p.get("lo52"),
            "d": p["d"], "div": p.get("div"),
            "news": ns.get("items") or [], "newsAt": ns.get("at"),
            "fund": f, "fundAt": (fund_state.get(x["id"]) or {}).get("at"), "m": met.get(x["id"]), "peers": peers,
            "earn": e, "earnAt": earn_state.get("at"), "an": a,
            "built": int(NOW),
        })
    fx = {}
    for pair in ("GBPUSD=X",):
        try:
            r = get_json(CHART.format(s=pair).replace("range=2y", "range=5d"))["chart"]["result"][0]["meta"]
            fx["GBPUSD"] = r["regularMarketPrice"]
        except Exception as e:
            ERR.append(f"FX failed: {e}")
    wjson("q.json", {"asOf": int(NOW), "fx": fx, "q": quotes})
    srch = [[x["id"], x.get("name") or "", x.get("kind"), x.get("exchange")] for x in U if x["id"] in px]
    for c in crypto.get("coins", []):
        srch.append([c["symbol"].upper(), c["name"], "crypto", c["id"], c.get("market_cap_rank")])
    wjson("search.json", {"asOf": int(NOW), "items": srch})
    for name, st in (("news.json", news_state), ("fund.json", fund_state), ("earnings.json", earn_state)):
        wjson("state/" + name, st)
    wjson("meta.json", {"built": int(NOW), "builtIso": iso(NOW), "stocks": len(px), "universe": len(U), "fundamentals": sum(1 for v in fund_state.values() if v.get("f")), "insiderTickers": n_ins, "coins": len(crypto.get("coins", [])), "errors": ERR, "log": LOG[-30:]})
    log("done", "errors:", ERR)


if __name__ == "__main__":
    main()
