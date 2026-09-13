// migrateConditionBlocks.ts
// Migration one-shot : conditions, roadmap, acceptation, principes et add-ons
// passent de { body, items[].subItems[] } / { description, items[] } à une liste
// plate de blocs { kind, depth, text }, le même modèle que la portée du projet.
//
// Usage : cd scripts && npx tsx migrateConditionBlocks.ts [--dry-run]
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
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

type BlockKind = 'paragraph' | 'bullet' | 'numbered' | 'heading';
interface Block {
  id: string;
  kind: BlockKind;
  depth: number;
  text: string;
}

interface LegacyEntry {
  blocks?: Block[];
  body?: string;
  description?: string;
  items?: Array<{ text?: string; subItems?: Array<{ text?: string }> }>;
}

const block = (text: string, kind: BlockKind = 'paragraph', depth = 0): Block => ({
  id: randomUUID(),
  kind,
  depth,
  text: text.trim(),
});

const BULLET_RULE = /^[-*+•·][ \t]/;
const NUMBERED_RULE = /^(\d{1,3}[.)]|[a-zA-Z][.)])[ \t]/;
const HEADING_RULE = /^#{1,6}[ \t]/;

/** Texte brut multi-ligne : l'indentation source donne la profondeur. */
const blocksFromText = (raw: string): Block[] => {
  const lines = (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const indentStack: number[] = [];
  const blocks: Block[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const width = line.length - line.trimStart().length;
    while (indentStack.length && width < indentStack[indentStack.length - 1]) indentStack.pop();
    if (!indentStack.length || width > indentStack[indentStack.length - 1]) indentStack.push(width);

    let kind: BlockKind = 'paragraph';
    let text = trimmed;
    if (HEADING_RULE.test(trimmed)) {
      kind = 'heading';
      text = trimmed.replace(/^#{1,6}[ \t]/, '');
    } else if (BULLET_RULE.test(trimmed)) {
      kind = 'bullet';
      text = trimmed.replace(BULLET_RULE, '');
    } else if (NUMBERED_RULE.test(trimmed)) {
      kind = 'numbered';
      text = trimmed.replace(NUMBERED_RULE, '');
    } else if (/^[▪◦‣⁃]/.test(trimmed)) {
      kind = 'bullet';
      text = trimmed.slice(1).trim();
    }

    if (!text) continue;
    blocks.push(block(text, kind, Math.min(indentStack.length - 1, 3)));
  }

  return blocks;
};

/** items[] -> blocs ; sinon repli sur body / description. */
const blocksFromEntry = (entry: LegacyEntry): Block[] => {
  if (entry.blocks?.length) return entry.blocks;

  if (entry.items?.length) {
    const blocks: Block[] = [];
    for (const item of entry.items) {
      const text = (item.text || '').trim();
      if (text) blocks.push(block(text, 'bullet', 0));
      for (const sub of item.subItems || []) {
        const subText = (sub.text || '').trim();
        if (subText) blocks.push(block(subText, 'bullet', 1));
      }
    }
    if (blocks.length) return blocks;
  }

  return blocksFromText(entry.body || entry.description || '');
};

const migrateEntries = (
  entries: LegacyEntry[] | undefined,
): { entries: Record<string, unknown>[]; changed: boolean } => {
  if (!Array.isArray(entries)) return { entries: [], changed: false };
  let changed = false;

  const migrated = entries.map((entry) => {
    const next: Record<string, unknown> = { ...entry };
    if (!entry.blocks?.length) {
      const converted = blocksFromEntry(entry);
      if (converted.length) {
        next.blocks = converted;
        changed = true;
      }
    }
    return next;
  });

  return { entries: migrated, changed };
};

const CONDITION_FIELDS = ['conditions', 'roadmap', 'acceptance', 'principles'] as const;

/** Renvoie le patch à écrire pour un document (devis ou slice de template). */
const migrateContent = (data: Record<string, any>) => {
  const payload: Record<string, unknown> = {};
  let changed = false;

  for (const field of CONDITION_FIELDS) {
    const result = migrateEntries(data[field]);
    if (!result.changed) continue;
    payload[field] = result.entries;
    changed = true;
  }

  const addons = migrateEntries(data.addons);
  if (addons.changed) {
    payload.addons = addons.entries;
    changed = true;
  }

  return { payload, changed };
};

/* ------------------------------------------------------------------ */
/* Parcours des collections                                            */
/* ------------------------------------------------------------------ */

const LOCALES = ['fr', 'en', 'es'] as const;

async function migrateQuotes(): Promise<number> {
  const snapshot = await db.collection('quotes').get();
  let updated = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const { payload, changed } = migrateContent(data);
    if (!changed) continue;
    if (!dryRun) await document.ref.update(payload);
    updated += 1;
    console.log(`  ✅ devis ${data.quoteRef || document.id}`);
  }

  console.log(`📄 ${snapshot.size} devis parcouru(s), ${updated} migré(s).`);
  return updated;
}

async function migrateTemplates(): Promise<number> {
  const snapshot = await db.collection('quoteTemplates').get();
  let updated = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const root = migrateContent(data);
    const payload: Record<string, unknown> = { ...root.payload };
    let changed = root.changed;

    const localized = { ...(data.localizedContent || {}) };
    for (const locale of LOCALES) {
      const slice = localized[locale];
      if (!slice) continue;
      const result = migrateContent(slice);
      if (!result.changed) continue;
      localized[locale] = { ...slice, ...result.payload };
      changed = true;
    }
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
  console.log(
    `\n🧱 MIGRATION — Conditions, roadmap, add-ons vers des blocs${dryRun ? ' (simulation)' : ''}\n`,
  );
  const quotes = await migrateQuotes();
  const templates = await migrateTemplates();
  console.log(
    `\n🎉 Terminé. ${quotes} devis et ${templates} template(s) ${dryRun ? 'seraient migrés' : 'migrés'}.\n`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Migration interrompue :', error);
  process.exit(1);
});
