// mergeProjects.ts
// Fusionne un projet dans un autre (un même projet qui a vécu longtemps : devis initial + avenants + hors devis).
//  - les devis du projet absorbé sont rattachés au projet conservé ;
//  - ses étapes liées à un devis sont ajoutées (le devis accepté est renommé « Devis accepté — <réf> ») ;
//    ses étapes de production génériques (travail, validation, livraison…) sont ignorées : le projet conservé a déjà les siennes ;
//  - sessions, temps total, suppléments et notes sont cumulés ; la date de début la plus ancienne est conservée ;
//  - le budget stocké devient la somme des deux ; le projet absorbé est supprimé (sauf --keep-absorbed).
// Usage : cd scripts && npx tsx mergeProjects.ts --keep <idConservé> --absorb <idAbsorbé> [--title "Nouveau titre"] [--dry-run]
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(__dirname, './serviceAccount.json'), 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const arg = (name: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || '' : '';
};
const dryRun = process.argv.includes('--dry-run');
const keepAbsorbed = process.argv.includes('--keep-absorbed');

type Doc = Record<string, any>;

async function main() {
  const keepId = arg('keep');
  const absorbId = arg('absorb');
  if (!keepId || !absorbId || keepId === absorbId) {
    throw new Error('Usage : --keep <id> --absorb <id> [--title "..."] [--dry-run] [--keep-absorbed]');
  }

  const [keepRef, absorbRef] = [db.collection('projects').doc(keepId), db.collection('projects').doc(absorbId)];
  const [keepSnap, absorbSnap] = await Promise.all([keepRef.get(), absorbRef.get()]);
  if (!keepSnap.exists || !absorbSnap.exists) throw new Error('Projet introuvable.');
  const keep = keepSnap.data() as Doc;
  const absorb = absorbSnap.data() as Doc;
  if (keep.userId !== absorb.userId) throw new Error('Les deux projets n’appartiennent pas au même utilisateur.');

  console.log(`\n🔗 FUSION${dryRun ? ' (dry-run)' : ''} : « ${absorb.title} » → « ${keep.title} »\n`);

  const absorbQuotes = await db.collection('quotes').where('projectId', '==', absorbId).get();
  const quoteLabel = new Map<string, string>(absorbQuotes.docs.map((d) => [d.id, d.data().quoteRef || d.data().title || d.id]));

  const keptMilestones: Doc[] = keep.milestones || [];
  const addedMilestones: Doc[] = (absorb.milestones || [])
    .filter((m: Doc) => m.quoteId || m.addOnId)
    .map((m: Doc) =>
      m.kind === 'quote_accepted' && m.quoteId
        ? { ...m, label: `Devis accepté — ${quoteLabel.get(m.quoteId) || ''}`.trim() }
        : m,
    );

  const sessions = [...(keep.sessions || []), ...(absorb.sessions || [])].sort(
    (a: Doc, b: Doc) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const notes = [keep.notes, absorb.notes].map((v) => String(v || '').trim()).filter(Boolean).join('\n\n');
  const startedAt = [keep.startedAt, absorb.startedAt].filter(Boolean).sort()[0] || '';

  const update: Doc = {
    title: arg('title') || keep.title,
    milestones: [...keptMilestones, ...addedMilestones],
    sessions,
    totalTrackedSeconds: sessions.reduce((total: number, s: Doc) => total + Number(s.durationSeconds || 0), 0),
    projectSupplements: [...(keep.projectSupplements || []), ...(absorb.projectSupplements || [])],
    notes,
    startedAt,
    budgetExVat: Number(keep.budgetExVat || 0) + Number(absorb.budgetExVat || 0),
    invoicedExVat: Number(keep.invoicedExVat || 0) + Number(absorb.invoicedExVat || 0),
    paidExVat: Number(keep.paidExVat || 0) + Number(absorb.paidExVat || 0),
    billingWaivedExVat: Number(keep.billingWaivedExVat || 0) + Number(absorb.billingWaivedExVat || 0),
  };

  console.log(`  titre            : ${update.title}`);
  console.log(`  devis déplacés   : ${absorbQuotes.size} (${[...quoteLabel.values()].join(', ') || '—'})`);
  console.log(`  étapes ajoutées  : ${addedMilestones.length} (${addedMilestones.map((m) => m.label).join(' | ')})`);
  console.log(`  étapes ignorées  : ${(absorb.milestones || []).length - addedMilestones.length} (production générique)`);
  console.log(`  temps cumulé     : ${(update.totalTrackedSeconds / 3600).toFixed(1)} h sur ${sessions.length} session(s)`);
  console.log(`  budget stocké    : ${update.budgetExVat} € HT · début ${update.startedAt}`);
  console.log(`  projet absorbé   : ${keepAbsorbed ? 'conservé' : 'supprimé'}`);

  if (!dryRun) {
    await Promise.all(absorbQuotes.docs.map((d) => d.ref.update({ projectId: keepId })));
    await keepRef.update(update);
    if (!keepAbsorbed) await absorbRef.delete();
    console.log('\n✅ Fusion terminée.\n');
  } else {
    console.log('\nℹ️  Dry-run : rien n’a été écrit.\n');
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
