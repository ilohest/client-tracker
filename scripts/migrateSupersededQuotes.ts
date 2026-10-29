// migrateSupersededQuotes.ts
// Migration one-shot : le statut « Remplacé » (superseded) n'existe plus. Les anciennes versions
// concernées repassent en « Révision demandée » ; l'historique des versions reste lisible via versionGroupId.
// Usage : cd scripts && npx tsx migrateSupersededQuotes.ts [--dry-run]
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(__dirname, './serviceAccount.json'), 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const snap = await db.collection('quotes').where('status', '==', 'superseded').get();
  console.log(`${snap.size} devis « Remplacé » trouvé(s)${dryRun ? ' (dry-run)' : ''}`);
  for (const doc of snap.docs) {
    console.log(` - ${doc.id} ${doc.data().reference || ''} v${doc.data().version || 1}`);
    if (!dryRun) await doc.ref.update({ status: 'revision_requested' });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
