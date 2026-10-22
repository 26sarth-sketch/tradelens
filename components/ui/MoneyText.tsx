// Free text (AI coach output, auto-tag reasons, plan checks) can contain ₹ amounts.
// Wrap each one in `.money` so privacy mode blurs it like every other figure.
const AMOUNT = /([+\-−]?₹\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:K|L|Cr|lakh|crore)\b)?)/g;

export function MoneyText({ text }: { text: string }) {
  const parts = text.split(AMOUNT);
  if (parts.length === 1) return <>{text}</>;
  // One wrapper, so a flex parent (icon + text list items) sees a single child.
  return <span>{parts.map((p, i) => (i % 2 ? <span key={i} className="money">{p}</span> : p))}</span>;
}
