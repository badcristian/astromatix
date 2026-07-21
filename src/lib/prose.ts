// The extractor flattens a section's copy into a flat array of strings — a lead
// paragraph, then the <li>s of a bulleted list, then a closing paragraph — with
// no marker for which were list items. The originals DO render bullets (e.g.
// demo-aanvraag's "Vacatures adverteert en optimaliseert / Campagnes opzet en
// beheert / …"), so reconstruct them: a run of items that follows a line ending
// in ":" and whose members are fragments (no terminal . ! ?) is a list.

export type Piece =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

const endsSentence = (s: string) => /[.!?]["')\]]?\s*$/.test(s);
const endsColon = (s: string) => /:\s*$/.test(s);

// A vacancy description arrives as one flat string[] — intro paragraphs, then
// bold section headings ("Wat ga je doen?", "Wat breng jij mee?", "Wat wij je
// bieden?") with bulleted lists under some of them, all with no structure. The
// original renders the headings bold and the lists as <ul>s. Reconstruct that:
//   - a heading is a short (<=55) line ending in "?"
//   - within a section (heading → next heading), if >=3 lines are short
//     fragments they're a bullet list (the longer intro / ":" lines stay paras);
//     otherwise the section is all paragraphs (the closing "Ben jij de juiste
//     persoon?" block is two sentences, not a list).
export type JobPiece =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

export function parseJobBody(body: string[], skipFirst = false): JobPiece[] {
  const lines = skipFirst ? body.slice(1) : body;
  const isHeading = (s: string) => s.length <= 55 && /\?\s*$/.test(s);
  const isBullet = (s: string) => s.length <= 120 && !/:\s*$/.test(s);
  const out: JobPiece[] = [];
  let i = 0;
  while (i < lines.length && !isHeading(lines[i])) out.push({ kind: 'p', text: lines[i++] });
  while (i < lines.length) {
    out.push({ kind: 'h', text: lines[i++] });
    const start = i;
    while (i < lines.length && !isHeading(lines[i])) i++;
    const section = lines.slice(start, i);
    if (section.filter(isBullet).length >= 3) {
      let bullets: string[] = [];
      const flush = () => { if (bullets.length) { out.push({ kind: 'ul', items: bullets }); bullets = []; } };
      for (const line of section) {
        if (isBullet(line)) bullets.push(line);
        else { flush(); out.push({ kind: 'p', text: line }); }
      }
      flush();
    } else {
      for (const line of section) out.push({ kind: 'p', text: line });
    }
  }
  return out;
}

export function splitBody(body: string[]): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  while (i < body.length) {
    const line = body[i];
    // A ":" lead-in immediately followed by a fragment starts a bullet list.
    if (endsColon(line) && i + 1 < body.length && !endsSentence(body[i + 1]) && !endsColon(body[i + 1])) {
      out.push({ kind: 'p', text: line });
      i++;
      const items: string[] = [];
      while (i < body.length && !endsSentence(body[i]) && !endsColon(body[i])) {
        items.push(body[i]);
        i++;
      }
      out.push({ kind: 'ul', items });
    } else {
      out.push({ kind: 'p', text: line });
      i++;
    }
  }
  return out;
}
