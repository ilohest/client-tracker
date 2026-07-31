// migrateQuoteBlocks.ts
// Migration one-shot : le contenu d'une ligne de devis passe de
//   { description, displayMode, items[].subItems[], subSections[] }
// à une liste plate de blocs { kind, depth, text } (modèle éditeur de blocs).
// Convertit aussi part.displayStyle 'text'|'table' -> 'flow'|'framed'.
//
// Usage : cd scripts && npx tsx migrateQuoteBlocks.ts [--dry-run]
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, './serviceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const dryRun = process.argv.includes('--dry-run');

/* ------------------------------------------------------------------ */
/* Formes legacy                                                       */
/* ------------------------------------------------------------------ */

interface LegacySubItem {
  text?: string;
}
interface LegacyItem {
  text?: string;
  subItems?: LegacySubItem[];
}
interface LegacySubSection {
  title?: string;
  body?: string;
}
interface LegacySection {
  id?: string;
  title?: string;
  description?: string;
  displayMode?: string;
  items?: LegacyItem[];
  subSections?: LegacySubSection[];
  price?: number;
  blocks?: unknown[];
}
interface LegacyPart {
  displayStyle?: string;
  sections?: LegacySection[];
  [key: string]: unknown;
}

type BlockKind = 'paragraph' | 'bullet' | 'numbered' | 'heading';
interface Block {
  id: string;
  kind: BlockKind;
  depth: number;
  text: string;
}

const BULLET_PREFIX = /^[-*+•·▪◦‣][ \t]*/;

const block = (kind: BlockKind, depth: number, text: string): Block => ({
  id: randomUUID(),
  kind,
  depth,
  text,
});

/**
 * Le champ `description` acceptait déjà du texte à puces façon markdown
 * (rendu en <ul> dans le PDF) : on le retranscrit fidèlement en blocs, en
 * conservant l'indentation à 2 espaces utilisée par les contenus par défaut.
 */
const blocksFromRichText = (raw: string, baseDepth: number): Block[] => {
  const lines = (raw || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const leading = /^[ \t]*/.exec(line)?.[0] || '';
    const indent = leading.split('').reduce((width, char) => width + (char === '\t' ? 2 : 1), 0);
    const nested = Math.min(3, baseDepth + Math.floor(indent / 2));

    if (BULLET_PREFIX.test(trimmed)) {
      blocks.push(block('bullet', nested, trimmed.replace(BULLET_PREFIX, '')));
      return;
    }
    blocks.push(block('paragraph', Math.min(3, baseDepth), trimmed));
  });

  return blocks;
};

const sectionToBlocks = (section: LegacySection): Block[] => {
  const displayMode = section.displayMode || 'bullets';
  const blocks: Block[] = [];

  // 'title' = texte simple, sans puce ni numérotation.
  if (displayMode === 'title') {
    blocks.push(...blocksFromRichText(section.description || '', 0));
  } else {
    blocks.push(...blocksFromRichText(section.description || '', 0));
    const kind: BlockKind = displayMode === 'numbered' ? 'numbered' : 'bullet';
    (section.items || []).forEach((item) => {
      const text = (item.text || '').trim();
      if (text) blocks.push(block(kind, 0, text));
      (item.subItems || []).forEach((sub) => {
        const subText = (sub.text || '').trim();
        if (subText) blocks.push(block(kind, 1, subText));
      });
    });
  }

  // Les sous-sections deviennent un titre suivi de leur corps.
  (section.subSections || []).forEach((sub) => {
    const title = (sub.title || '').trim();
    if (title) blocks.push(block('heading', 0, title));
    blocks.push(...blocksFromRichText(sub.body || '', 0));
  });

  return blocks;
};

const migrateParts = (parts: unknown): { parts: LegacyPart[]; changed: boolean } => {
  if (!Array.isArray(parts)) return { parts: [], changed: false };
  let changed = false;

  const migrated = (parts as LegacyPart[]).map((part) => {
    const next: LegacyPart = { ...part };

    if (part.displayStyle === 'text' || part.displayStyle === 'table') {
      next.displayStyle = part.displayStyle === 'table' ? 'framed' : 'flow';
      changed = true;
    } else if (!part.displayStyle) {
      next.displayStyle = 'flow';
      changed = true;
    }

    next.sections = (part.sections || []).map((section) => {
      // Déjà migrée : on n'y retouche pas (le script est rejouable).
      if (Array.isArray(section.blocks)) {
        return { id: section.id || randomUUID(), title: section.title || '', blocks: section.blocks };
      }
      changed = true;
      return {
        id: section.id || randomUUID(),
        title: section.title || '',
        blocks: sectionToBlocks(section),
      };
    });

    return next;
  });

  return { parts: migrated, changed };
};

/* ------------------------------------------------------------------ */
/* Parcours des collections                                            */
/* ------------------------------------------------------------------ */

const LOCALES = ['fr', 'en', 'es'] as const;

async function migrateQuotes(): Promise<number> {
  const snapshot = await db.collection('quotes').get();
  let updated = 0;

  for (const document of snapshot.docs) {
    const { parts, changed } = migrateParts(document.data().parts);
    if (!changed) continue;
    if (!dryRun) await document.ref.update({ parts });
    updated += 1;
    console.log(`  ✅ devis ${document.data().quoteRef || document.id}`);
  }

  console.log(`📄 ${snapshot.size} devis parcouru(s), ${updated} migré(s).`);
  return updated;
}

async function migrateTemplates(): Promise<number> {
  const snapshot = await db.collection('quoteTemplates').get();
  let updated = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const payload: Record<string, unknown> = {};
    let changed = false;

    const root = migrateParts(data.parts);
    if (root.changed) {
      payload.parts = root.parts;
      changed = true;
    }

    const localized = { ...(data.localizedContent || {}) };
    LOCALES.forEach((locale) => {
      const slice = localized[locale];
      if (!slice) return;
      const result = migrateParts(slice.parts);
      if (!result.changed) return;
      localized[locale] = { ...slice, parts: result.parts };
      changed = true;
    });
    if (changed && data.localizedContent) payload.localizedContent = localized;

    if (!changed) continue;
    if (!dryRun) await document.ref.update(payload);
    updated += 1;
    console.log(`  ✅ template ${data.name || document.id}`);
  }

  console.log(`🧩 ${snapshot.size} template(s) parcouru(s), ${updated} migré(s).`);
  return updated;
}

async function main() {
  console.log(`\n🧱 MIGRATION — Contenu des devis vers des blocs${dryRun ? ' (simulation)' : ''}\n`);
  const quotes = await migrateQuotes();
  const templates = await migrateTemplates();
  console.log(
    `\n🎉 Terminé. ${quotes} devis et ${templates} template(s) ${dryRun ? 'seraient migrés' : 'migrés'}.\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erreur :', error);
  process.exit(1);
});
