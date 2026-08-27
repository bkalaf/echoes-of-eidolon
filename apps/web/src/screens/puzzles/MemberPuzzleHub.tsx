import { PublicShell } from "../../components/shells/Shells";
import type { getMemberPuzzleCatalog } from "../../server/member-puzzles";

export function MemberPuzzleHub({ puzzles }: { puzzles: ReturnType<typeof getMemberPuzzleCatalog> }) {
  return <PublicShell><div className="member-puzzle-page stack"><header className="member-puzzle-hero"><p className="kicker">Member Collection</p><h1>Witness Puzzles</h1><p>Four artifacts wait behind the archive doors. Each can be solved independently and replayed at any time.</p></header><section aria-label="Member puzzle collection" className="member-puzzle-hub">{puzzles.map((puzzle, index) => <article className={`member-puzzle-card member-puzzle-card--${index + 1}`} key={puzzle.publicSlug}><span aria-hidden="true" className="member-puzzle-card__sigil">{["Ⅱ", "∪", "▧", "𝄞"][index]}</span><p className="kicker">Puzzle {index + 1}</p><h2>{puzzle.publicTitle}</h2><p>{puzzle.publicDescription}</p><a className="button button--gold" href={`/puzzles/${puzzle.publicSlug}`}>Open</a></article>)}</section></div></PublicShell>;
}
