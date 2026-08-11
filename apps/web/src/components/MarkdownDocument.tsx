import { Fragment, type ReactNode } from "react";

function inlineText(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a href={link[2]} key={index}>{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownDocument({ source }: { source: string }) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) nodes.push(<p key={`p-${nodes.length}`}>{inlineText(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const text = inlineText(heading[2]);
      nodes.push(heading[1].length === 1 ? <h1 key={`h-${nodes.length}`}>{text}</h1>
        : heading[1].length === 2 ? <h2 key={`h-${nodes.length}`}>{text}</h2>
          : heading[1].length === 3 ? <h3 key={`h-${nodes.length}`}>{text}</h3>
            : <h4 key={`h-${nodes.length}`}>{text}</h4>);
      continue;
    }
    if (line.startsWith("> ")) { flushParagraph(); nodes.push(<blockquote key={`q-${nodes.length}`}>{inlineText(line.slice(2))}</blockquote>); continue; }
    if (/^[-*]\s+/.test(line)) { flushParagraph(); nodes.push(<ul key={`ul-${nodes.length}`}><li>{inlineText(line.replace(/^[-*]\s+/, ""))}</li></ul>); continue; }
    if (/^\d+\.\s+/.test(line)) { flushParagraph(); nodes.push(<ol key={`ol-${nodes.length}`}><li>{inlineText(line.replace(/^\d+\.\s+/, ""))}</li></ol>); continue; }
    if (line.startsWith("|")) { flushParagraph(); if (!/^\|[\s:|-]+\|$/.test(line)) nodes.push(<p className="legal-table-row" key={`t-${nodes.length}`}>{inlineText(line.split("|").filter(Boolean).map((cell) => cell.trim()).join(" · "))}</p>); continue; }
    paragraph.push(line);
  }
  flushParagraph();
  return <>{nodes}</>;
}
