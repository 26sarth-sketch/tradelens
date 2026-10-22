// What the in-app Guide knows about TradeLens. This is the single source of truth for both the
// built-in (no-AI) help and the AI Guide's prompt, so answers stay tied to what the app really has.
// Keep it in sync with the screens: every `href` must exist (guide.test.ts checks them).

export type GuideRoute = { href: string; label: string };

export const LESSON_SLUGS: GuideRoute[] = [
  { href: "/learn/how-to-use-tradelens", label: "Lesson: How to use this journal" },
  { href: "/learn/r-multiple", label: "Lesson: What is an R-multiple?" },
  { href: "/learn/profit-factor", label: "Lesson: Profit factor" },
  { href: "/learn/why-charges-matter", label: "Lesson: Why charges matter" },
  { href: "/learn/position-sizing", label: "Lesson: Position sizing" },
  { href: "/learn/revenge-trading", label: "Lesson: Revenge trading" },
  { href: "/learn/expiry-day-risk", label: "Lesson: Expiry-day risk" },
  { href: "/learn/lens-score", label: "Lesson: How the Lens Score works" },
];

/** Every page the Guide may send someone to. Links from the AI are checked against this list. */
export const GUIDE_ROUTES: GuideRoute[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Daily Journal" },
  { href: "/trades", label: "Trade Log" },
  { href: "/trades/new", label: "Add a trade" },
  { href: "/trades/import", label: "Import trades" },
  { href: "/trades/tags", label: "Auto-tag review" },
  { href: "/reports", label: "Reports" },
  { href: "/reports/compare", label: "Compare" },
  { href: "/strategies", label: "Strategies" },
  { href: "/strategies/new", label: "New strategy" },
  { href: "/notebook", label: "Notebook" },
  { href: "/coach", label: "AI Coach: ask your journal" },
  { href: "/coach?tab=session", label: "Session review" },
  { href: "/coach?tab=weekly", label: "Weekly review" },
  { href: "/coach?tab=journal", label: "Journal analysis" },
  { href: "/progress", label: "Progress" },
  { href: "/learn", label: "Learn" },
  { href: "/settings", label: "Settings" },
  ...LESSON_SLUGS,
];

export type GuideTopic = {
  id: string;
  title: string;
  href: string;
  keywords: string[];
  summary: string;
  steps?: string[];
};

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "what-is",
    title: "What TradeLens is",
    href: "/learn/how-to-use-tradelens",
    keywords: ["what is", "tradelens", "about", "overview", "purpose", "journal", "start", "begin", "new", "first time", "how does it work"],
    summary:
      "TradeLens is a trading journal for Indian traders. You bring in your broker's tradebook, it works out your true P&L after every Indian charge, finds the habits that cost you money, and an AI coach reviews your process. It is an educational journaling tool, not investment advice.",
  },
  {
    id: "import-zerodha",
    title: "Import a Zerodha tradebook",
    href: "/trades/import",
    keywords: ["import", "upload", "zerodha", "kite", "console", "tradebook", "csv", "bring", "add trades", "broker file"],
    summary: "The fastest way to fill the journal. Fills are grouped into complete trades, charges are computed, duplicates are skipped, and open positions are flagged.",
    steps: [
      "In Zerodha Console go to Reports → Tradebook, pick Equity and/or F&O and a date range, then download the CSV.",
      "In TradeLens click **Add trades** in the sidebar, then choose **Zerodha**.",
      "Upload the CSV, check the preview, then click **Import**. You can undo an import from its summary page.",
    ],
  },
  {
    id: "import-other",
    title: "Import from Upstox, Angel One, Groww, Dhan or another broker",
    href: "/trades/import",
    keywords: ["upstox", "angel", "groww", "dhan", "other broker", "mapping", "map columns", "generic", "icici", "5paisa", "different broker"],
    summary: "Other brokers use the column mapper: pick your broker to pre-fill the column names, check each field, preview, then import.",
    steps: [
      "Click **Add trades**, then **Upstox, Angel One, Groww, Dhan & others**.",
      "Upload your tradebook CSV and choose your broker to pre-fill the mapping.",
      "Check each field, click **Preview trades**, then **Import**.",
    ],
  },
  {
    id: "sample-data",
    title: "Try it with sample data",
    href: "/trades/import",
    keywords: ["sample", "demo", "try", "example", "test", "dummy", "no csv", "dont have", "don't have"],
    summary: "No tradebook handy? The import page has a **Try the sample file** button, and the app already comes with a demo journal of about 60 trading days.",
    steps: ["Open **Add trades**.", "Click **Try the sample file** to preview an example tradebook, then **Import**."],
  },
  {
    id: "manual-entry",
    title: "Add a trade manually",
    href: "/trades/new",
    keywords: ["manual", "add trade", "enter trade", "type", "single trade", "one trade", "manually", "new trade", "log a trade"],
    summary: "Log one finished round trip by hand. A live preview shows every charge and the net P&L before you save.",
    steps: [
      "Open **Add trades**, then click **Add manually** (or go to Trade Log → **Add trade**).",
      "Pick the instrument type, fill symbol, strike, expiry, lots, entry and exit premium, date and times.",
      "Check the live P&L preview and click **Save trade**.",
    ],
  },
  {
    id: "undo-import",
    title: "Undo an import or fix duplicates",
    href: "/trades/import",
    keywords: ["undo", "wrong file", "duplicate", "twice", "mistake import", "remove import", "delete import", "uploaded twice"],
    summary: "Duplicates are skipped automatically, so importing the same file twice adds nothing new. To remove an import, open its summary page and click **Undo import**.",
  },
  {
    id: "open-position",
    title: "'Open position not imported' warning",
    href: "/trades/import",
    keywords: ["open position", "not imported", "still open", "warning", "skipped", "commodity", "mcx", "currency"],
    summary:
      "A trade is only imported once it is closed. A position you still hold (bought but not yet sold) is reported, not imported; import again after you exit. Commodity and currency rows are skipped because they are not supported yet.",
  },
  {
    id: "dashboard",
    title: "The Dashboard",
    href: "/dashboard",
    keywords: ["dashboard", "home", "overview", "stats", "summary", "net pnl", "win rate", "profit factor", "expectancy", "drawdown", "cards", "equity curve", "calendar"],
    summary:
      "Your headline numbers: net P&L, win rate, profit factor, average win vs loss, expectancy, max drawdown, total charges and trades per day. Below are the charges bar, the equity curve, today's risk-rule widget, the Lens Score and a P&L calendar. Use **30D / 60D / All** to change the range.",
  },
  {
    id: "views",
    title: "Switch between ₹, % of capital, R-multiple and points",
    href: "/dashboard",
    keywords: ["view", "units", "rupees", "percent", "% of capital", "r-multiple view", "points", "toggle", "switch", "show in"],
    summary:
      "The toggle at the top right of the Dashboard changes every number between ₹, % of capital, R-multiple and index points. R needs a stop-loss on the trade; points apply to index trades.",
  },
  {
    id: "charges",
    title: "Charges and true net P&L",
    href: "/learn/why-charges-matter",
    keywords: ["charges", "brokerage", "stt", "gst", "stamp", "fees", "net pnl", "true pnl", "cost", "tax", "exchange fee", "sebi fee", "after charges"],
    summary:
      "Every trade's net P&L is gross minus brokerage, STT, exchange charges, SEBI fee, stamp duty and GST (plus a DP charge on delivery sells). The Dashboard shows what share of gross profit the charges ate. Open a trade to see the full breakdown.",
  },
  {
    id: "brokerage-plan",
    title: "Change the brokerage plan or recalculate charges",
    href: "/settings",
    keywords: ["brokerage plan", "flat 20", "discount broker", "recalculate", "wrong charges", "charges wrong", "change plan", "full service"],
    summary: "In **Settings**, pick your brokerage plan; changing it recalculates charges on all trades. **Recalculate charges on all trades** is under Data in Settings.",
    steps: ["Open **Settings**.", "Under Trader profile choose your **Brokerage plan** and click **Save profile**."],
  },
  {
    id: "trade-log",
    title: "The Trade Log and filters",
    href: "/trades",
    keywords: ["trade log", "trades", "list", "table", "filter", "search", "find trade", "symbol", "all trades", "history"],
    summary:
      "Every trade, newest first, with segment, side, quantity, entry and exit, gross, charges and net. Filter by dates, segment, result or symbol, then click a row to open the trade.",
  },
  {
    id: "trade-review",
    title: "Review a trade: strategy, emotions, plan, stop-loss",
    href: "/trades",
    keywords: ["review", "trade detail", "tag", "emotion", "strategy", "followed plan", "stop loss", "stop-loss", "target", "notes", "screenshot", "chart", "high low", "mfe", "mae", "journal a trade", "edit trade"],
    summary:
      "Click any trade to review it: choose a strategy, set whether you followed your plan, mark your emotion before and after, add tags, a stop-loss and target (which gives you the R-multiple), the high and low price (money left on the table), notes and a chart screenshot. Click **Save review**.",
    steps: ["Open **Trade Log** and click a trade.", "Fill the review form at the bottom of the page.", "Click **Save review**."],
  },
  {
    id: "screenshots",
    title: "Attach a chart screenshot",
    href: "/trades",
    keywords: ["screenshot", "chart image", "picture", "attach", "image", "upload image"],
    summary:
      "On a trade's page, use **Add a screenshot of your chart** (PNG, JPG, WebP or GIF up to 5 MB). On the shared live demo, screenshot upload is switched off.",
  },
  {
    id: "journal",
    title: "The Daily Journal",
    href: "/journal",
    keywords: ["daily journal", "journal", "day", "diary", "day card", "daily notes", "each day"],
    summary: "One card per trading day with that day's trades, a running P&L line, rule breaches and your notes. Click a day to open it.",
  },
  {
    id: "reports",
    title: "Reports: where the money comes from and where it leaks",
    href: "/reports",
    keywords: ["reports", "report", "analysis", "by time", "weekday", "day of week", "time of day", "segment", "symbol", "emotion", "expiry", "breakdown", "which day", "leak"],
    summary:
      "Break your results down by day of week, time of day, segment, symbol, strategy, tag, emotion and expiry vs normal days. The filter bar at the top applies to every tab.",
  },
  {
    id: "compare",
    title: "Compare two sets of trades",
    href: "/reports/compare",
    keywords: ["compare", "versus", "vs", "before after", "followed plan vs", "side by side", "two sets", "difference"],
    summary:
      "Put any two sets of trades side by side. One-click presets include followed plan vs broke plan and before vs after 2 PM; or build your own filters for each side.",
    steps: ["Open **Reports**, click **Compare two sets**.", "Pick a preset or set the filters for sets A and B.", "Read the difference per trade."],
  },
  {
    id: "strategies",
    title: "Strategies (playbooks)",
    href: "/strategies",
    keywords: ["strategy", "strategies", "playbook", "setup", "checklist", "rules", "entry rules", "exit rules", "create strategy", "new strategy"],
    summary:
      "Write each setup as a checklist of entry, exit and risk rules. Tick the rules you followed on each trade's review and the strategy page shows its stats, R distribution and how often each rule is followed.",
    steps: ["Open **Strategies** and click **New strategy**.", "Name it and add entry, exit and risk rules.", "Click **Create strategy**, then pick it on a trade's review."],
  },
  {
    id: "missed-trades",
    title: "Log a missed trade",
    href: "/strategies",
    keywords: ["missed trade", "missed", "didn't take", "did not take", "trade i didn't take", "trade i did not take", "skipped setup", "setup i skipped", "hesitated", "left on the table"],
    summary: "On a strategy's page, use **Missed trades for this strategy** to record a setup you did not take, with the reason and what it would have made.",
  },
  {
    id: "risk-rules",
    title: "Set your risk rules",
    href: "/settings",
    keywords: ["risk", "risk rules", "daily loss", "max loss", "limit", "stop after losses", "cutoff", "cut-off", "no trade after", "max trades", "breach", "rules broken", "discipline"],
    summary:
      "Under **Settings → Risk rules** set a max daily loss, max trades per day, max loss per trade, stop after N losses in a row, and a time after which you take no new trades. The Dashboard widget shows today's status and your breach history.",
    steps: ["Open **Settings**.", "Fill the **Risk rules** card (leave a box empty to turn a rule off).", "Click **Save risk rules**; history is re-checked."],
  },
  {
    id: "notebook",
    title: "Notebook: pre-market plan and end-of-day reflection",
    href: "/notebook",
    keywords: ["notebook", "plan", "pre-market", "premarket", "reflection", "end of day", "eod", "daily plan", "mood", "discipline rating", "plan vs actual"],
    summary:
      "Before the market, set your max trades, max loss, the strategies you will trade and your mood, then **Save plan**. After the close, write what went well and what to change, rate your discipline and **Save reflection**. The page compares plan vs what actually happened, and the AI session review uses it.",
  },
  {
    id: "ai-coach",
    title: "AI Coach: ask your journal",
    href: "/coach",
    keywords: ["ai coach", "coach", "ask", "chat", "question", "ai", "assistant", "ask journal", "win rate on", "do i lose"],
    summary:
      "Ask questions about your own trades, such as \"What's my win rate on expiry days?\". Every number is computed from your journal and checked before it is shown. It never recommends what to buy or sell.",
    steps: ["Open **AI Coach**.", "Type a question or click one of the examples."],
  },
  {
    id: "ai-no-key",
    title: "AI Coach says it is off",
    href: "/coach",
    keywords: ["ai off", "no key", "api key", "not working", "connect", "enable ai", "openrouter", "ai disabled", "key"],
    summary:
      "The AI features need an OpenRouter API key set by whoever runs the app (the `OPENROUTER_API_KEY` setting). Everything else, including imports, charges, reports, risk rules, the auto-tagger and this Guide's built-in help, works without it.",
  },
  {
    id: "session-review",
    title: "AI session review",
    href: "/coach?tab=session",
    keywords: ["session review", "review my day", "today review", "review session", "day review", "plan vs actual review"],
    summary:
      "Compares one day's pre-market plan and risk rules with what you actually did: rules broken, what went well, what to fix and tomorrow's focus. Write your plan in the Notebook first for the best result.",
  },
  {
    id: "weekly-review",
    title: "AI weekly review",
    href: "/coach?tab=weekly",
    keywords: ["weekly review", "week review", "weekly", "this week", "last week", "three rules", "strengths and mistakes"],
    summary: "Top 3 strengths, top 3 mistakes and 3 rules for next week, compared with your previous four weeks. Use the arrows to move between weeks.",
  },
  {
    id: "journal-analysis",
    title: "AI journal analysis",
    href: "/coach?tab=journal",
    keywords: ["journal analysis", "analyse", "analyze", "what does my data say", "full analysis", "insights", "patterns"],
    summary: "A full read of your journal: what is working, where money leaks and your next three process steps. Without an AI key the same page shows a computed summary instead.",
  },
  {
    id: "trade-feedback",
    title: "AI feedback on a single trade",
    href: "/trades",
    keywords: ["trade feedback", "coach feedback", "feedback", "judge trade", "good trade", "bad trade", "process rating"],
    summary: "Open a trade and click **Get coach feedback**. It judges your process (plan, stop-loss, sizing, timing, emotion), not just whether the trade made money.",
  },
  {
    id: "auto-tag",
    title: "Auto-tagger: find revenge trades and overtrading",
    href: "/trades/tags",
    keywords: ["auto tag", "autotag", "auto-tag", "revenge", "overtrading", "held too long", "after cutoff", "tags", "mistakes", "tag mistakes", "scan"],
    summary:
      "It scans your trades for revenge trades, overtrading, losers held too long and entries after your cut-off, each with the exact reason. Accept what is true and dismiss the rest. It works without AI.",
    steps: ["Open **Trade Log** and click **Auto-tag**.", "Click **Scan my trades**.", "Use **Accept** or **Dismiss**, or **Accept all**."],
  },
  {
    id: "lens-score",
    title: "Lens Score",
    href: "/learn/lens-score",
    keywords: ["lens score", "score", "grade", "rating", "points out of 100", "radar", "level", "what is my score", "improve score"],
    summary:
      "A 0 to 100 score for your process, built from six parts: win rate, profit factor, average win vs loss, drawdown, green days and plan adherence. It needs at least 10 trades. It is on the Dashboard and the Progress page. To raise it: follow your plan (tick \"followed my plan\" on trades), set and respect risk rules, use stop-losses, and avoid red days from overtrading.",
  },
  {
    id: "progress",
    title: "Progress over time",
    href: "/progress",
    keywords: ["progress", "improving", "better", "streak", "discipline calendar", "trend", "am i improving", "disciplined days"],
    summary: "Is your process improving? See the rolling Lens Score, disciplined-day streaks (no rule breach, no broken plan), a 12-week discipline calendar and a weekly table.",
  },
  {
    id: "privacy",
    title: "Privacy mode",
    href: "/dashboard",
    keywords: ["privacy", "hide amounts", "hide money", "blur", "screen share", "hide rupee", "hide numbers", "private"],
    summary: "Click **Privacy mode** at the bottom of the sidebar to blur every rupee amount, handy when sharing your screen. Click it again to show them.",
  },
  {
    id: "learn",
    title: "Learn: short lessons",
    href: "/learn",
    keywords: ["learn", "lesson", "tutorial", "teach", "explain", "terms", "glossary", "what does mean", "beginner", "education", "r-multiple", "profit factor", "position sizing"],
    summary:
      "Eight short lessons in plain English: how to use the journal, R-multiple, profit factor, why charges matter, position sizing, revenge trading, expiry-day risk and the Lens Score. Look for the **Learn more** links next to dashboard numbers.",
  },
  {
    id: "settings",
    title: "Settings: profile, experience level and language",
    href: "/settings",
    keywords: ["settings", "profile", "name", "capital", "experience level", "beginner", "expert", "hinglish", "language", "preferences"],
    summary:
      "In **Settings** you set your name, trading capital, experience level (Beginner, Intermediate or Expert, which changes how the AI explains things), coach language (English or Hinglish), broker and brokerage plan.",
  },
  {
    id: "reset-demo",
    title: "Reset to demo data",
    href: "/settings",
    keywords: ["reset", "demo data", "start over", "clear", "wipe", "delete everything", "restore demo", "fresh start"],
    summary:
      "**Settings → Data → Reset to demo data** wipes everything and reloads about 60 days of sample trades. It cannot be undone, so only use it when you want a clean slate.",
  },
  {
    id: "no-advice",
    title: "Can TradeLens tell me what to buy or sell?",
    href: "/learn/how-to-use-tradelens",
    keywords: ["tip", "tips", "buy", "sell", "recommend", "target", "prediction", "advice", "which stock", "what to trade", "signal", "call", "should i buy", "should i sell", "what to buy", "what to sell", "stock tip", "price target", "give me a target"],
    summary:
      "No. TradeLens is an educational journaling tool. It reviews your own past trades and habits and never recommends securities, targets or market direction; that would need SEBI registration.",
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcut for this Guide",
    href: "/dashboard",
    keywords: ["shortcut", "keyboard", "hotkey", "open guide", "help", "question mark"],
    summary: "Press **?** (Shift + /) anywhere in the app to open or close this Guide, and **Esc** to close it.",
  },
];

/** Plain-language meanings for common terms (used by the built-in help). */
export const GLOSSARY: Record<string, string> = {
  "r-multiple": "How many times your planned risk you made or lost. If you risked ₹2,000 and made ₹3,000, that is +1.5R. It needs a stop-loss on the trade.",
  "profit factor": "Total money won divided by total money lost. Above 1 means you made more than you lost.",
  expectancy: "What an average trade is worth: win rate times average win, minus loss rate times average loss.",
  drawdown: "The biggest fall from a peak in your equity curve before it recovered.",
  "win rate": "The share of your trades that made money.",
  mfe: "Maximum favourable excursion: the best price the trade reached. TradeLens uses your high and low price to show money left on the table.",
  stt: "Securities Transaction Tax, charged by the government on trades; part of your charges.",
};

export function topicText(t: GuideTopic): string {
  return `- ${t.title} [${t.href}]: ${t.summary}${t.steps ? ` Steps: ${t.steps.map((s, i) => `${i + 1}) ${s}`).join(" ")}` : ""}`;
}

/** The whole knowledge base as compact text for the AI prompt. */
export function knowledgeForPrompt(): string {
  const routes = GUIDE_ROUTES.map((r) => `${r.href} = ${r.label}`).join("\n");
  const glossary = Object.entries(GLOSSARY)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  return [`ALLOWED LINKS (use only these exact hrefs):\n${routes}`, `APP KNOWLEDGE:\n${GUIDE_TOPICS.map(topicText).join("\n")}`, `GLOSSARY:\n${glossary}`].join("\n\n");
}
