import { MoneyText } from "@/components/ui/MoneyText";
/**
 * Minimal renderer for coach and lesson text: paragraphs, "- " bullet lists (also
 * directly under a heading line), **bold** and *italic*. Renders text only, never HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}><MoneyText text={part.slice(2, -2)} /></strong>
      ) : part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
        <em key={i}><MoneyText text={part.slice(1, -1)} /></em>
      ) : (
        <span key={i}><MoneyText text={part} /></span>
      ),
    );
  const isBullet = (l: string) => /^\s*[-•*]\s+/.test(l);

  const nodes: React.ReactNode[] = [];
  text.split(/\n{2,}/).forEach((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim());
    let i = 0;
    while (i < lines.length) {
      if (isBullet(lines[i])) {
        const items: string[] = [];
        while (i < lines.length && isBullet(lines[i])) items.push(lines[i++].replace(/^\s*[-•*]\s+/, ""));
        nodes.push(
          <ul key={`${bi}-${i}`} className="my-1 list-disc space-y-0.5 pl-5">
            {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </ul>,
        );
      } else {
        const para: string[] = [];
        while (i < lines.length && !isBullet(lines[i])) para.push(lines[i++]);
        nodes.push(
          <p key={`${bi}-${i}`} className="my-1">
            {para.map((l, j) => <span key={j}>{inline(l)}{j < para.length - 1 && <br />}</span>)}
          </p>,
        );
      }
    }
  });
  return <div className={className}>{nodes}</div>;
}
