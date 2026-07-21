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
