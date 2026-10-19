// migrateTimesheetsIntoProjects.ts
// Migration one-shot : fusionne la collection `timesheets` dans `projects`.
//  - chaque timesheet liée à un projet (projectId ou project.timesheetId) est absorbée par ce projet ;
//  - une timesheet sans projet devient un nouveau projet ;
//  - les statuts projet passent de 10 valeurs à 3 (in_progress / delivered / closed) ;
//  - `health`, `blockedReason`, `timesheetId` et `projectNotes` disparaissent (les notes sont concaténées dans `notes`).
// Les timesheets ne sont supprimées qu'avec --delete-timesheets (à lancer après vérification).
// --skip-orphans : ne crée pas de projet pour les timesheets sans projet (à utiliser si ce sont des doublons).
// Usage : cd scripts && npx tsx migrateTimesheetsIntoProjects.ts [--dry-run] [--skip-orphans] [--delete-timesheets]
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(__dirname, './serviceAccount.json'), 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const dryRun = process.argv.includes('--dry-run');
const deleteTimesheets = process.argv.includes('--delete-timesheets');
const skipOrphans = process.argv.includes('--skip-orphans');

type Doc = Record<string, any>;

const mapStatus = (status: string, timesheetStatus?: string): 'in_progress' | 'delivered' | 'closed' => {
  if (['paid', 'closed'].includes(status) || timesheetStatus === 'closed' || timesheetStatus === 'archived') return 'closed';
  if (['ready_to_invoice', 'invoiced'].includes(status)) return 'delivered';
  return 'in_progress';
};

const mergeNotes = (project: Doc): string => {
  const entries: Doc[] = Array.isArray(project.projectNotes) ? project.projectNotes : [];
  const parts = [project.notes || '', ...entries.map((entry) => entry.content || '')]
    .map((value) => String(value).trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join('\n\n');
};

const timeFields = (timesheet?: Doc) => ({
  sessions: timesheet?.sessions || [],
  totalTrackedSeconds: Number(timesheet?.totalTrackedSeconds || 0),
  activeStartedAt: timesheet?.activeStartedAt || '',
});

async function main() {
  console.log(`\n🔀 MIGRATION — Timesheets vers projets${dryRun ? ' (dry-run)' : ''}\n`);

  const [projectsSnap, timesheetsSnap] = await Promise.all([
    db.collection('projects').get(),
    db.collection('timesheets').get(),
  ]);
  console.log(`📁 ${projectsSnap.size} projet(s), ⏱️  ${timesheetsSnap.size} timesheet(s).`);

  const timesheets = new Map<string, Doc>(timesheetsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const consumed = new Set<string>();
  let merged = 0;
  let created = 0;

  for (const projectDoc of projectsSnap.docs) {
    const project = projectDoc.data();
    const timesheet =
      (project.timesheetId && timesheets.get(project.timesheetId)) ||
      Array.from(timesheets.values()).find((entry) => entry.projectId === projectDoc.id);
    if (timesheet) consumed.add(timesheet.id);

    const update: Doc = {
      status: mapStatus(project.status || 'in_progress', timesheet?.status),
      notes: mergeNotes(project),
      ...timeFields(timesheet),
      budgetExVat: Number(project.budgetExVat || 0) || Number(timesheet?.fixedPriceExVat || 0),
      hourlyRate: Number(project.hourlyRate || 0) || Number(timesheet?.hourlyRate || 0),
      startedAt: project.startedAt || timesheet?.projectStartDate || '',
      health: FieldValue.delete(),
      blockedReason: FieldValue.delete(),
      timesheetId: FieldValue.delete(),
      projectNotes: FieldValue.delete(),
    };
    if (!project.clientId && timesheet?.clientId) {
      update.clientId = timesheet.clientId;
      update.clientName = timesheet.clientName || '';
    }

    console.log(`  ${timesheet ? '🔗' : '📄'} "${project.title}" ← ${timesheet ? `timesheet ${timesheet.id}` : 'sans timesheet'}`);
    if (!dryRun) await projectDoc.ref.update(update);
    if (timesheet) merged += 1;
  }

  for (const timesheet of timesheets.values()) {
    if (consumed.has(timesheet.id)) continue;
    const hours = (Number(timesheet.totalTrackedSeconds || 0) / 3600).toFixed(1);
    const details = `${(timesheet.sessions || []).length} session(s), ${hours} h, userId ${timesheet.userId}, id ${timesheet.id}`;
    if (skipOrphans) {
      console.log(`  ⏭️  Timesheet orpheline ignorée "${timesheet.title}" (${details})`);
      continue;
    }
    console.log(`  ➕ Nouveau projet depuis la timesheet orpheline "${timesheet.title}" (${details})`);
    if (!dryRun) {
      await db.collection('projects').add({
        userId: timesheet.userId,
        title: timesheet.title || 'Projet sans titre',
        description: '',
        notes: '',
        projectSupplements: [],
        sourceType: timesheet.sourceType || 'custom',
        clientId: timesheet.clientId || '',
        clientName: timesheet.clientName || '',
        color: timesheet.color,
        status: mapStatus('in_progress', timesheet.status),
        budgetExVat: Number(timesheet.fixedPriceExVat || 0),
        invoicedExVat: 0,
        paidExVat: 0,
        billingWaivedExVat: 0,
        hourlyRate: Number(timesheet.hourlyRate || 0),
        startedAt: timesheet.projectStartDate || '',
        dueDate: '',
        closedAt: '',
        nextAction: '',
        milestones: [],
        ...timeFields(timesheet),
        createdAt: timesheet.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    created += 1;
  }

  if (deleteTimesheets && !dryRun) {
    await Promise.all(timesheetsSnap.docs.map((d) => d.ref.delete()));
    console.log(`🗑️  ${timesheetsSnap.size} timesheet(s) supprimée(s).`);
  }

  console.log(`\n🎉 Terminé. ${merged} fusionnée(s), ${created} projet(s) créé(s) depuis des timesheets orphelines.`);
  if (!deleteTimesheets) console.log('ℹ️  Les timesheets sont conservées : relance avec --delete-timesheets une fois la fusion vérifiée.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
