import type { QuoteBlock, QuoteBlockKind, QuoteTable, QuoteTableRow } from '@client-tracker/contracts';
import { createEntityId } from './id';

export const MAX_BLOCK_DEPTH = 3;

/** Un tableau démarre en 2 colonnes x 2 lignes : assez pour être utile, assez petit pour être vite rempli. */
const DEFAULT_TABLE_COLUMNS = 2;
const DEFAULT_TABLE_ROWS = 2;

const clampDepth = (depth: number): number =>
  Math.min(MAX_BLOCK_DEPTH, Math.max(0, Math.trunc(Number(depth) || 0)));

export const createBlock = (partial: Partial<QuoteBlock> = {}): QuoteBlock => {
  const kind: QuoteBlockKind = partial.kind || 'paragraph';
  return {
    id: createEntityId(),
    kind,
    depth: kind === 'table' ? 0 : clampDepth(partial.depth ?? 0),
    text: partial.text || '',
    ...(kind === 'table' ? { table: partial.table || createEmptyTable() } : {}),
  };
};

export const cloneBlocks = (blocks: QuoteBlock[] = []): QuoteBlock[] =>
  blocks.map((block) => ({
    ...block,
    id: createEntityId(),
    ...(block.table
      ? {
          table: {
            ...block.table,
            rows: (block.table.rows || []).map((row) => ({
              ...row,
              id: createEntityId(),
              cells: [...(row.cells || [])],
            })),
            columns: [...(block.table.columns || [])],
          },
        }
      : {}),
  }));

/**
 * Blocs prêts pour Firestore : aucune clé `undefined`, tableaux alignés.
 * Les identifiants sont omis dans les DTO d'entrée (ils sont régénérés au
 * chargement par `hydrateBlocks`).
 */
export const serializeBlocks = (
  blocks: QuoteBlock[] = [],
  { withIds }: { withIds: boolean },
): QuoteBlock[] =>
  blocks.map((block) => {
    const serialized = {
      ...(withIds ? { id: block.id || createEntityId() } : {}),
      kind: block.kind || 'paragraph',
      depth: clampDepth(block.depth ?? 0),
      text: block.text || '',
    } as QuoteBlock;
    if (block.kind === 'table') {
      serialized.table = normalizeTable(block.table || createEmptyTable());
      serialized.depth = 0;
    }
    return serialized;
  });

/** Complète les identifiants manquants à la lecture d'un document Firestore. */
export const hydrateBlocks = (blocks: QuoteBlock[] = []): QuoteBlock[] =>
  blocks.map((block) => {
    const hydrated: QuoteBlock = {
      id: block.id || createEntityId(),
      kind: block.kind || 'paragraph',
      depth: clampDepth(block.depth ?? 0),
      text: block.text || '',
    };
    if (block.kind === 'table') {
      const table = normalizeTable(block.table || createEmptyTable());
      hydrated.table = {
        ...table,
        rows: table.rows.map((row) => ({ ...row, id: row.id || createEntityId() })),
      };
      hydrated.depth = 0;
    }
    return hydrated;
  });

/** Compare deux listes de blocs sans tenir compte des identifiants (garde "modifications non sauvegardées"). */
export const comparableBlocks = (blocks: QuoteBlock[] = []) =>
  blocks.map((block) => ({
    kind: block.kind || 'paragraph',
    depth: clampDepth(block.depth ?? 0),
    text: block.text || '',
    table: block.table
      ? {
          columns: [...(block.table.columns || [])],
          hasHeader: block.table.hasHeader !== false,
          rows: (block.table.rows || []).map((row) => [...(row.cells || [])]),
        }
      : null,
  }));

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

export const createTableRow = (columnCount: number, cells: string[] = []): QuoteTableRow => ({
  id: createEntityId(),
  cells: Array.from({ length: columnCount }, (_, index) => cells[index] || ''),
});

export const createEmptyTable = (
  columnCount = DEFAULT_TABLE_COLUMNS,
  rowCount = DEFAULT_TABLE_ROWS,
): QuoteTable => ({
  columns: Array.from({ length: columnCount }, () => ''),
  rows: Array.from({ length: rowCount }, () => createTableRow(columnCount)),
  hasHeader: true,
});

/** Aligne toutes les lignes sur le nombre de colonnes (après ajout/suppression ou collage). */
export const normalizeTable = (table: QuoteTable): QuoteTable => {
  const columnCount = Math.max(1, table.columns.length);
  return {
    columns: Array.from({ length: columnCount }, (_, index) => table.columns[index] || ''),
    hasHeader: table.hasHeader !== false,
    rows: (table.rows || []).map((row) => ({
      id: row.id || createEntityId(),
      cells: Array.from({ length: columnCount }, (_, index) => row.cells?.[index] || ''),
    })),
  };
};

const buildTableFromGrid = (grid: string[][], hasHeader: boolean): QuoteTable | null => {
  const rows = grid.filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 1) return null;
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount < 2) return null;
  const [first, ...rest] = rows;
  return normalizeTable({
    columns: hasHeader ? first : Array.from({ length: columnCount }, () => ''),
    rows: (hasHeader ? rest : rows).map((cells) => createTableRow(columnCount, cells)),
    hasHeader,
  });
};

const MARKDOWN_TABLE_SEPARATOR = /^\|?[\s:|-]+\|[\s:|-]*$/;

/**
 * Reconnaît une grille dans du texte brut : TSV (Excel, Sheets, Numbers) ou
 * tableau markdown. Retourne `null` si le texte n'est pas tabulaire.
 */
export const parseTableFromText = (raw: string): QuoteTable | null => {
  const lines = (raw || '').replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim());
  if (lines.length < 2) return null;

  if (lines.every((line) => line.includes('\t'))) {
    return buildTableFromGrid(
      lines.map((line) => line.split('\t').map((cell) => cell.trim())),
      true,
    );
  }

  const pipeLines = lines.filter((line) => line.trim().startsWith('|') || line.includes(' | '));
  if (pipeLines.length === lines.length) {
    const body = lines.filter((line) => !MARKDOWN_TABLE_SEPARATOR.test(line.trim()));
    const hasSeparator = body.length !== lines.length;
    return buildTableFromGrid(
      body.map((line) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim()),
      ),
      hasSeparator,
    );
  }

  return null;
};

/* ------------------------------------------------------------------ */
/* Raccourcis markdown à la saisie                                     */
/* ------------------------------------------------------------------ */

const HEADING_RULE = /^#{1,6}[ \t]/;
const BULLET_RULE = /^[-*+•·][ \t]/;
const NUMBERED_RULE = /^(\d{1,3}[.)]|[a-zA-Z][.)])[ \t]/;

/**
 * Convertit un préfixe markdown tapé en début de bloc ("- ", "1. ", "## ") en
 * type de bloc. Retourne `null` s'il n'y a rien à convertir — le sélecteur de
 * type devient alors inutile dans le flux de frappe.
 */
export const matchInputRule = (
  text: string,
): { kind: QuoteBlockKind; text: string } | null => {
  if (HEADING_RULE.test(text)) {
    return { kind: 'heading', text: text.replace(/^#{1,6}[ \t]/, '') };
  }
  if (BULLET_RULE.test(text)) {
    return { kind: 'bullet', text: text.replace(BULLET_RULE, '') };
  }
  if (NUMBERED_RULE.test(text)) {
    return { kind: 'numbered', text: text.replace(NUMBERED_RULE, '') };
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Collage : texte brut                                                */
/* ------------------------------------------------------------------ */

const LEADING_WS = /^[ \t]*/;
const TAB_WIDTH = 4;

const indentWidth = (line: string): number =>
  (LEADING_WS.exec(line)?.[0] || '')
    .split('')
    .reduce((width, char) => width + (char === '\t' ? TAB_WIDTH : 1), 0);

const detectMarker = (
  trimmed: string,
): { kind: QuoteBlockKind; text: string } => {
  const rule = matchInputRule(trimmed);
  if (rule) return rule;
  // Puces unicode que les traitements de texte insèrent sans espace après.
  if (/^[▪◦‣⁃]/.test(trimmed)) {
    return { kind: 'bullet', text: trimmed.slice(1).trim() };
  }
  return { kind: 'paragraph', text: trimmed };
};

/**
 * Reconstruit une arborescence de blocs à partir de texte brut multi-ligne.
 * Les niveaux d'indentation sont déduits par pile : peu importe que la source
 * indente avec 2 espaces, 4 espaces ou des tabulations.
 */
export const parseBlocksFromText = (raw: string): QuoteBlock[] => {
  const table = parseTableFromText(raw);
  if (table) return [createBlock({ kind: 'table', table })];

  const lines = (raw || '').replace(/\r\n?/g, '\n').split('\n');
  const indentStack: number[] = [];
  const blocks: QuoteBlock[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const width = indentWidth(line);
    while (indentStack.length && width < indentStack[indentStack.length - 1]) {
      indentStack.pop();
    }
    if (!indentStack.length || width > indentStack[indentStack.length - 1]) {
      indentStack.push(width);
    }

    const { kind, text } = detectMarker(trimmed);
    if (!text) return;
    blocks.push(createBlock({ kind, depth: indentStack.length - 1, text }));
  });

  return normalizeBlockDepths(blocks);
};

/* ------------------------------------------------------------------ */
/* Collage : HTML riche                                                */
/* ------------------------------------------------------------------ */

const cleanInlineText = (value: string): string =>
  value.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

/** Texte d'un élément, en excluant les listes et tableaux imbriqués. */
const ownText = (element: Element): string => {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('ul, ol, table').forEach((nested) => nested.remove());
  return cleanInlineText(clone.textContent || '');
};

const tableFromElement = (element: HTMLTableElement): QuoteTable | null => {
  const rows = Array.from(element.rows).map((row) =>
    Array.from(row.cells).map((cell) => cleanInlineText(cell.textContent || '')),
  );
  const hasHeader =
    element.tHead !== null ||
    (element.rows[0] ? Array.from(element.rows[0].cells).every((cell) => cell.tagName === 'TH') : false);
  return buildTableFromGrid(rows, hasHeader || rows.length > 1);
};

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'DD', 'DT']);

const walkHtml = (node: Element, depth: number, blocks: QuoteBlock[]): void => {
  Array.from(node.children).forEach((child) => {
    const tag = child.tagName;

    if (tag === 'TABLE') {
      const table = tableFromElement(child as HTMLTableElement);
      if (table) blocks.push(createBlock({ kind: 'table', table }));
      return;
    }

    if (tag === 'UL' || tag === 'OL') {
      const kind: QuoteBlockKind = tag === 'OL' ? 'numbered' : 'bullet';
      Array.from(child.children)
        .filter((item) => item.tagName === 'LI')
        .forEach((item) => {
          const text = ownText(item);
          if (text) blocks.push(createBlock({ kind, depth, text }));
          walkHtml(item, Math.min(MAX_BLOCK_DEPTH, depth + 1), blocks);
        });
      return;
    }

    if (HEADING_TAGS.has(tag)) {
      const text = ownText(child);
      if (text) blocks.push(createBlock({ kind: 'heading', depth, text }));
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      // Un conteneur qui n'enveloppe que d'autres blocs ne produit pas de bloc à lui seul.
      const hasBlockChildren = Array.from(child.children).some(
        (grandChild) =>
          BLOCK_TAGS.has(grandChild.tagName) ||
          HEADING_TAGS.has(grandChild.tagName) ||
          ['UL', 'OL', 'TABLE'].includes(grandChild.tagName),
      );
      if (!hasBlockChildren) {
        const text = ownText(child);
        if (text) blocks.push(createBlock({ kind: 'paragraph', depth, text }));
        return;
      }
      walkHtml(child, depth, blocks);
      return;
    }

    walkHtml(child, depth, blocks);
  });
};

const parseBlocksFromHtml = (html: string): QuoteBlock[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, script, meta, link').forEach((node) => node.remove());
  const blocks: QuoteBlock[] = [];
  walkHtml(doc.body, 0, blocks);
  return normalizeBlockDepths(blocks);
};

const hasStructuredHtml = (html: string): boolean =>
  /<(ul|ol|li|table|h[1-6]|p)\b/i.test(html);

/**
 * Point d'entrée du collage : privilégie le HTML du presse-papier (Notion,
 * Google Docs, ChatGPT, pages web) qui conserve les listes et les tableaux,
 * et retombe sur l'analyse du texte brut sinon.
 */
export const parseClipboardBlocks = (data: DataTransfer | null): QuoteBlock[] => {
  const html = data?.getData('text/html') || '';
  const text = data?.getData('text/plain') || '';

  if (html && hasStructuredHtml(html)) {
    const blocks = parseBlocksFromHtml(html);
    if (blocks.length) return blocks;
  }
  return parseBlocksFromText(text);
};

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Empêche les sauts d'indentation (un bloc ne peut descendre que d'un niveau
 * par rapport au précédent) et remet les tableaux à la racine.
 */
export const normalizeBlockDepths = (blocks: QuoteBlock[]): QuoteBlock[] => {
  let previousDepth = -1;
  return blocks.map((block) => {
    if (block.kind === 'table') {
      previousDepth = 0;
      return { ...block, depth: 0 };
    }
    const depth = Math.min(clampDepth(block.depth), previousDepth + 1);
    previousDepth = depth;
    return { ...block, depth };
  });
};

/** Numéro affiché pour un bloc numéroté : redémarre à chaque rupture de série au même niveau. */
export const numberedIndex = (blocks: QuoteBlock[], index: number): number => {
  const block = blocks[index];
  let count = 1;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = blocks[cursor];
    if (previous.depth < block.depth) break;
    if (previous.depth > block.depth) continue;
    if (previous.kind !== 'numbered') break;
    count += 1;
  }
  return count;
};
