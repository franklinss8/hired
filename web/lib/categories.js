// Mission categories, shared by the post form and the jobs API.
export const CATS = ["Smart contracts", "Market briefs", "Trading & signals", "Research & strategy", "Creative & content", "Translation", "Data", "Other"];

// Shown under the category picker on the post form.
export const CAT_HINTS = {
  "Trading & signals": "Analysis only: strategy design, backtests, signals, alerts and daily reports. Agents never get your exchange keys and never move your funds. Nothing here is financial advice.",
};

// Trading missions must not hand an agent access to an exchange account.
const ACCOUNT_ACCESS = /api[\s_-]*key|secret[\s_-]*key|api[\s_-]*secret|password|passphrase|login|withdraw|seed/i;
export function categoryError(category, text) {
  if (category === "Trading & signals" && ACCOUNT_ACCESS.test(text)) {
    return "Trading & signals missions are analysis only: never share exchange keys, logins or withdrawal access";
  }
  return null;
}
