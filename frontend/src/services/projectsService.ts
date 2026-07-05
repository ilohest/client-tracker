import type { Project, ProjectInput } from '@client-tracker/contracts';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

const ensureUser = (): string => {
  if (!auth.currentUser) throw new Error('Utilisateur non connecté');
  return auth.currentUser.uid;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'string' || value instanceof Date) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    const parsed = value.toDate().getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
};

const toIsoDate = (value: unknown): string => {
  const millis = toMillis(value);
  if (!millis) return '';
  return new Date(millis).toISOString().slice(0, 10);
};

const defaultMilestones = (): Project['milestones'] => [
  { id: crypto.randomUUID(), label: 'Devis accepté', status: 'done', date: '', kind: 'quote_accepted' },
  { id: crypto.randomUUID(), label: "Facture d'acompte envoyée", status: 'todo', date: '', kind: 'invoice_sent', paymentScheduleIndex: 0 },
  { id: crypto.randomUUID(), label: 'Paiement reçu', status: 'todo', date: '', kind: 'payment_received', paymentScheduleIndex: 0 },
  { id: crypto.randomUUID(), label: 'Travail en cours', status: 'todo', date: '', kind: 'work' },
  { id: crypto.randomUUID(), label: 'Validation client', status: 'todo', date: '', kind: 'approval' },
  { id: crypto.randomUUID(), label: 'Facture finale envoyée', status: 'todo', date: '', kind: 'invoice_sent', paymentScheduleIndex: 1 },
  { id: crypto.randomUUID(), label: 'Paiement reçu', status: 'todo', date: '', kind: 'payment_received', paymentScheduleIndex: 1 },
];

const normalizeMilestone = (milestone: Project['milestones'][number]): Project['milestones'][number] => {
  const label = milestone.label === 'Facture finale payée' ? 'Paiement final reçu' : milestone.label;
  const kind =
    milestone.kind ||
    (label === 'Devis accepté'
      ? 'quote_accepted'
      : label.includes('Facture') && label.includes('envoyée')
        ? 'invoice_sent'
        : label === 'Acompte reçu' || label.includes('reçu')
          ? 'payment_received'
          : label === 'Travail en cours'
            ? 'work'
            : label === 'Validation client'
              ? 'approval'
              : 'custom');
  const paymentScheduleIndex =
    typeof milestone.paymentScheduleIndex === 'number'
      ? milestone.paymentScheduleIndex
      : label.includes('acompte') || label.includes('Acompte')
        ? 0
        : -1;

  return {
    ...milestone,
    label,
    kind,
    paymentScheduleStepId: milestone.paymentScheduleStepId || '',
    paymentScheduleIndex,
  };
};

const ensureFinalInvoiceSentMilestone = (milestones: Project['milestones']): Project['milestones'] => {
  const normalizedMilestones = milestones.map(normalizeMilestone);

  if (normalizedMilestones.some((milestone) => milestone.label === 'Facture finale envoyée')) return normalizedMilestones;

  const finalPaidIndex = normalizedMilestones.findIndex((milestone) => milestone.label === 'Paiement final reçu');
  const finalInvoiceSent = {
    id: crypto.randomUUID(),
    label: 'Facture finale envoyée',
    status: 'todo' as const,
    date: '',
    kind: 'invoice_sent' as const,
    paymentScheduleStepId: '',
    paymentScheduleIndex: -1,
  };

  if (finalPaidIndex < 0) return [...normalizedMilestones, finalInvoiceSent];
  return [
    ...normalizedMilestones.slice(0, finalPaidIndex),
    finalInvoiceSent,
    ...normalizedMilestones.slice(finalPaidIndex),
  ];
};

const normalizeProjectNotes = (item: Project): Project['projectNotes'] => {
  if (item.projectNotes?.length) return item.projectNotes;
  if (!item.notes?.trim()) return [];
  const createdAt = toIsoDate(item.createdAt) || new Date().toISOString().slice(0, 10);
  return [
    {
      id: crypto.randomUUID(),
      content: item.notes,
      createdAt,
      updatedAt: item.updatedAt ? toIsoDate(item.updatedAt) : '',
    },
  ];
};

const normalizeProjectSupplements = (item: Project): Project['projectSupplements'] =>
  (item.projectSupplements || []).map((supplement) => ({
    id: supplement.id || crypto.randomUUID(),
    title: supplement.title || 'Supplément',
    amountExVat: Number(supplement.amountExVat || 0),
    createdAt: supplement.createdAt || toIsoDate(item.createdAt) || new Date().toISOString().slice(0, 10),
  }));

const normalizeProject = (item: Project): Project => ({
  ...item,
  description: item.description || '',
  notes: item.notes || '',
  projectNotes: normalizeProjectNotes(item),
  projectSupplements: normalizeProjectSupplements(item),
  sourceType: item.sourceType || 'custom',
  quoteId: item.quoteId || '',
  quoteRef: item.quoteRef || '',
  timesheetId: item.timesheetId || '',
  clientId: item.clientId || '',
  clientName: item.clientName || '',
  color: item.color || '#e96a5f',
  status: item.status || 'in_progress',
  health: item.health || 'ok',
  budgetExVat: Number(item.budgetExVat || 0),
  invoicedExVat: Number(item.invoicedExVat || 0),
  paidExVat: Number(item.paidExVat || 0),
  hourlyRate: Number(item.hourlyRate || 0),
  startedAt: item.startedAt || toIsoDate(item.createdAt),
  dueDate: item.dueDate || '',
  closedAt: item.closedAt || '',
  blockedReason: item.blockedReason || '',
  nextAction: item.nextAction || '',
  milestones: ensureFinalInvoiceSentMilestone(item.milestones?.length ? item.milestones : defaultMilestones()),
});

export const projectsService = {
  async fetchAll(): Promise<Project[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'projects'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => normalizeProject({ id: item.id, ...item.data() } as Project))
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  },

  async create(payload: ProjectInput): Promise<Project> {
    const userId = ensureUser();
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'projects'), {
      ...payload,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return normalizeProject({
      id: docRef.id,
      userId,
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
  },

  async update(id: string, payload: Partial<Project>): Promise<void> {
    await updateDoc(doc(db, 'projects', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', id));
  },
};
