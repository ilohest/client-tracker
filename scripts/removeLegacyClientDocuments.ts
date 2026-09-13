// Migration one-shot : supprime l'ancien champ `documents` des fiches clients.
// Usage : npm run remove-legacy-client-documents [-- --dry-run]
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

const main = async () => {
  console.log(`\n🧹 SUPPRESSION DU CHAMP DOCUMENTS CLIENT${dryRun ? ' (simulation)' : ''}\n`);
  const snapshot = await db.collection('clients').get();
  const targets = snapshot.docs.filter((document) =>
    Object.prototype.hasOwnProperty.call(document.data(), 'documents'),
  );

  for (const document of targets) {
    if (!dryRun) await document.ref.update({ documents: FieldValue.delete() });
    const data = document.data();
    console.log(`  ${dryRun ? '•' : '✅'} clients/${data.name || data.companyName || document.id}`);
  }

  console.log(
    `\nTerminé : ${targets.length}/${snapshot.size} client(s) ${dryRun ? 'seraient nettoyés' : 'nettoyés'}.\n`,
  );
};

main().catch((error) => {
  console.error('❌ Migration interrompue :', error);
  process.exitCode = 1;
});
