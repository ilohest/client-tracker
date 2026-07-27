// migrateProjectQuotes.ts
// Migration one-shot : bascule le lien projet <-> devis de `project.quoteId` (1 devis)
// vers `quote.projectId` (N devis par projet, pour supporter les avenants).
// Usage : cd scripts && npx tsx migrateProjectQuotes.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

interface LegacyMilestone {
  id: string;
  label: string;
  kind?: string;
  quoteId?: string;
  [key: string]: unknown;
}

async function main() {
  console.log('\n🔗 MIGRATION — Projets vers devis multiples\n');

  const projectsSnapshot = await db.collection('projects').get();
  console.log(`📁 ${projectsSnapshot.size} projet(s) trouvé(s).`);

  let linked = 0;
  let cleaned = 0;
  let skippedMissingQuote = 0;

  for (const projectDoc of projectsSnapshot.docs) {
    const project = projectDoc.data();
    const legacyQuoteId: string = project.quoteId || '';

    if (!legacyQuoteId) {
      // Rien à lier, mais on retire quand même les champs obsolètes s'ils traînent.
      if ('quoteId' in project || 'quoteRef' in project) {
        await projectDoc.ref.update({ quoteId: FieldValue.delete(), quoteRef: FieldValue.delete() });
        cleaned += 1;
      }
      continue;
    }

    const quoteRef = db.collection('quotes').doc(legacyQuoteId);
    const quoteSnapshot = await quoteRef.get();
    if (!quoteSnapshot.exists) {
      console.warn(`  ⚠️  Projet "${project.title}" (${projectDoc.id}) référence un devis introuvable (${legacyQuoteId}) — ignoré.`);
      skippedMissingQuote += 1;
      await projectDoc.ref.update({ quoteId: FieldValue.delete(), quoteRef: FieldValue.delete() });
      continue;
    }

    await quoteRef.update({ projectId: projectDoc.id });

    const milestones: LegacyMilestone[] = Array.isArray(project.milestones) ? project.milestones : [];
    const stampedMilestones = milestones.map((milestone) =>
      milestone.quoteId ? milestone : { ...milestone, quoteId: legacyQuoteId },
    );

    await projectDoc.ref.update({
      milestones: stampedMilestones,
      quoteId: FieldValue.delete(),
      quoteRef: FieldValue.delete(),
    });

    linked += 1;
    console.log(`  ✅ Projet "${project.title}" (${projectDoc.id}) ↔ devis ${legacyQuoteId}`);
  }

  console.log(`\n🎉 Terminé. ${linked} projet(s) lié(s), ${cleaned} nettoyé(s) sans devis, ${skippedMissingQuote} référence(s) cassée(s).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
