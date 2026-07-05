// @ts-check
// Lichtgewicht markdown voor de assistent-bubble (AI-5, plan 24 ronde D): het
// model antwoordt beknopt maar strooit **bold**, *cursief*, `code`, kopjes en
// lijstjes door de tekst — die renderden tot nu toe plat (letterlijke sterren).
// Dit is bewust een mini-subset, geen markdown-engine: puur en unit-getest,
// zodat de React-kant (MarkdownText in AssistantMessageView) alleen spans hoeft
// te tekenen. Streaming-vriendelijk: een nog niet gesloten marker aan het eind
// van een chunk stylet de rest van de regel (i.p.v. een litterende `**`).

/**
 * @typedef {{ text: string, bold?: boolean, italic?: boolean, code?: boolean }} Span
 * @typedef {{ type: 'paragraph'|'heading'|'bullet', marker?: string, spans: Span[] }} Block
 */

/**
 * Parse de inline-markers van één regel naar stijl-spans.
 * Ondersteund: `code` (binnen code geen andere markers), **bold**, *cursief*.
 * Een marker die niet meer sluit → de stijl loopt door tot het regeleinde.
 * @param {string} line
 * @returns {Span[]}
 */
export function parseInline(line) {
  const src = typeof line === 'string' ? line : '';
  /** @type {Span[]} */
  const spans = [];
  let buf = '';
  let bold = false;
  let italic = false;
  let code = false;
  const flush = () => {
    if (!buf) return;
    /** @type {Span} */
    const span = { text: buf };
    if (bold) span.bold = true;
    if (italic) span.italic = true;
    if (code) span.code = true;
    spans.push(span);
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '`') {
      flush();
      code = !code;
      i += 1;
    } else if (!code && ch === '*' && src[i + 1] === '*') {
      flush();
      bold = !bold;
      i += 2;
    } else if (!code && ch === '*') {
      flush();
      italic = !italic;
      i += 1;
    } else {
      buf += ch;
      i += 1;
    }
  }
  flush();
  return spans;
}

/**
 * Splits assistent-tekst in blokken: kopjes (`## …`), lijstregels (`- …`,
 * `* …`, `1. …`) en gewone alinea's. Lege regels verdwijnen (de renderer
 * regelt de witruimte). Bullets houden hun eigen marker: `•` voor streepjes,
 * het nummer voor genummerde lijsten.
 * @param {string} text
 * @returns {Block[]}
 */
export function parseBlocks(text) {
  const src = typeof text === 'string' ? text : '';
  /** @type {Block[]} */
  const blocks = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (heading) {
      blocks.push({ type: 'heading', spans: parseInline(heading[1]) });
      continue;
    }
    const dash = /^\s*[-•]\s+(.*)$/.exec(line);
    // Een `* `-bullet alleen als de regel niet met `**` (bold) opent.
    const star = !line.trim().startsWith('**') ? /^\s*\*\s+(.*)$/.exec(line) : null;
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    const bullet = dash ?? star;
    if (bullet) {
      blocks.push({ type: 'bullet', marker: '•', spans: parseInline(bullet[1]) });
      continue;
    }
    if (numbered) {
      blocks.push({ type: 'bullet', marker: `${numbered[1]}.`, spans: parseInline(numbered[2]) });
      continue;
    }
    blocks.push({ type: 'paragraph', spans: parseInline(line) });
  }
  return blocks;
}
