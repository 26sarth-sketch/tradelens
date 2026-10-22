// Casino-themed background for the app: little 🎰 🎲 🃏 💎 🍒 🪙 float and bob behind everything.
// Pure decoration (aria-hidden, no pointer events, behind the content). Motion is a slow CSS transform
// and is switched off for visitors who prefer reduced motion (see globals.css).
// The scatter is computed once from a fixed seed, so server and client always render the same thing.

const GLYPHS = ["🎰", "🎲", "🃏", "💎", "🍒", "🪙", "7️⃣", "♠️", "♥️"];

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rnd = lcg(21);
const ITEMS = Array.from({ length: 24 }, (_, i) => ({
  glyph: GLYPHS[i % GLYPHS.length],
  left: 2 + rnd() * 96,
  top: 2 + rnd() * 96,
  size: Math.round(22 + rnd() * 16),
  dur: Math.round(20 + rnd() * 18),
  delay: -Math.round(rnd() * 30),
  dx: Math.round((rnd() - 0.5) * 70),
  r0: Math.round((rnd() - 0.5) * 30),
  r1: Math.round((rnd() - 0.5) * 50),
}));

export function CasinoBackground() {
  return (
    <div className="casino-bg" aria-hidden>
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className="casino-float"
          style={
            {
              left: `${it.left}%`,
              top: `${it.top}%`,
              fontSize: it.size,
              animationDuration: `${it.dur}s`,
              animationDelay: `${it.delay}s`,
              "--dx": `${it.dx}px`,
              "--r0": `${it.r0}deg`,
              "--r1": `${it.r1}deg`,
            } as React.CSSProperties
          }
        >
          {it.glyph}
        </span>
      ))}
    </div>
  );
}
