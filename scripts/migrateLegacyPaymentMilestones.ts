// migrateLegacyPaymentMilestones.ts
// Migration one-shot : rattache les anciennes étapes financières génériques d'un projet
// (« Facture d'acompte envoyée » / « Acompte reçu », sans devis lié) à l'étape de paiement
// correspondante du devis. Sans ce lien, l'étape du devis reste « à facturer » sans rien à cocher.
//  - générique SANS doublon  -> on lui donne quoteId + paymentScheduleStepId du devis (état conservé) ;
//  - générique AVEC doublon (une étape liée au devis existe déjà pour le même paiement) -> supprimée,
//    en reportant son état « fait » sur l'étape du devis si besoin.
// Usage : cd scripts && npx tsx migrateLegacyPaymentMilestones.ts [--dry-run]
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

type Doc = Record<string, any>;
const FINANCIAL = ['invoice_sent', 'payment_received'];
const toMillis = (value: any): number => (value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : new Date(value || 0).getTime() || 0);

async function main() {
  console.log(`\n🧾 MIGRATION — Étapes de paiement génériques → étapes du devis${dryRun ? ' (dry-run)' : ''}\n`);
  const projects = await db.collection('projects').get();
  let changed = 0;

  for (const projectDoc of projects.docs) {
    const project = projectDoc.data();
    const milestones: Doc[] = Array.isArray(project.milestones) ? project.milestones : [];

    const quotesSnap = await db.collection('quotes').where('projectId', '==', projectDoc.id).get();
    const quotes = quotesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Doc))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const firstQuote = quotes[0];
    if (!firstQuote) continue;
    const schedule: Doc[] = firstQuote.paymentSchedule || [];

    const isGeneric = (m: Doc) =>
      FINANCIAL.includes(m.kind) && !m.quoteId && !m.addOnId && typeof m.paymentScheduleIndex === 'number' && m.paymentScheduleIndex >= 0;
    const findLinked = (m: Doc, stepId: string, index: number) =>
      milestones.find(
        (x) => x !== m && x.kind === m.kind && x.quoteId === firstQuote.id && (x.paymentScheduleStepId ? x.paymentScheduleStepId === stepId : x.paymentScheduleIndex === index),
      );

    const notes: string[] = [];
    const next: Doc[] = [];
    for (const m of milestones) {
      if (!isGeneric(m)) {
        next.push(m);
        continue;
      }
      const step = schedule[m.paymentScheduleIndex];
      if (!step) {
        next.push(m);
        continue;
      }
      const linked = findLinked(m, step.id, m.paymentScheduleIndex);
      if (linked) {
        // Si le doublon générique était coché et pas l'étape du devis, on reporte l'état « fait ».
        const carryDone = m.status === 'done' && linked.status !== 'done';
        if (carryDone) {
          linked.status = 'done';
          linked.date = linked.date || m.date || '';
        }
        notes.push(`supprimé doublon « ${m.label} »${carryDone ? ' (état « fait » reporté sur l’étape du devis)' : ''}`);
        continue;
      }
      notes.push(`« ${m.label} » rattaché à ${firstQuote.quoteRef} / ${step.label}`);
      next.push({ ...m, quoteId: firstQuote.id, paymentScheduleStepId: step.id });
    }

    if (!notes.length) continue;
    changed += 1;
    console.log(`  🔧 "${project.title}" (${projectDoc.id})\n     - ${notes.join('\n     - ')}`);
    if (!dryRun) await projectDoc.ref.update({ milestones: next });
  }

  console.log(`\n🎉 Terminé. ${changed} projet(s) ${dryRun ? 'à corriger' : 'corrigé(s)'}.\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
