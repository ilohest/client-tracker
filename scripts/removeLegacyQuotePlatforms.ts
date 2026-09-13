// Migration one-shot : supprime l'ancien champ `platform` des devis et templates.
// Le champ `customPlatformLabel` contient désormais les technologies et est conservé.
//
// Usage : npm run remove-legacy-quote-platforms [-- --dry-run]
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(scriptDirectory, './serviceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const dryRun = process.argv.includes('--dry-run');

const removeFromCollection = async (collectionName: 'quotes' | 'quoteTemplates') => {
  const snapshot = await db.collection(collectionName).get();
  const targets = snapshot.docs.filter((document) =>
    Object.prototype.hasOwnProperty.call(document.data(), 'platform'),
  );

  for (const document of targets) {
    if (!dryRun) await document.ref.update({ platform: FieldValue.delete() });
    const data = document.data();
    console.log(`  ${dryRun ? '•' : '✅'} ${collectionName}/${data.quoteRef || data.name || document.id}`);
  }

  console.log(`${collectionName}: ${targets.length}/${snapshot.size} document(s) ${dryRun ? 'à nettoyer' : 'nettoyé(s)'}.`);
  return targets.length;
};

const main = async () => {
  console.log(`\n🧹 SUPPRESSION DES ANCIENNES PLATEFORMES${dryRun ? ' (simulation)' : ''}\n`);
  const quotes = await removeFromCollection('quotes');
  const templates = await removeFromCollection('quoteTemplates');
  console.log(`\nTerminé : ${quotes} devis et ${templates} template(s) ${dryRun ? 'seraient modifiés' : 'modifiés'}.\n`);
};

main().catch((error) => {
  console.error('❌ Migration interrompue :', error);
  process.exitCode = 1;
});
