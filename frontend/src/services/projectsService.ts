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
  { id: crypto.randomUUID(), label: 'Cadrage initial validé', status: 'done', date: '', kind: 'custom' },
  { id: crypto.randomUUID(), label: 'Travail en cours', status: 'todo', date: '', kind: 'work' },
  { id: crypto.randomUUID(), label: 'Validation client', status: 'todo', date: '', kind: 'approval' },
  { id: crypto.randomUUID(), label: 'Implémentation des retours', status: 'todo', date: '', kind: 'work' },
  { id: crypto.randomUUID(), label: 'Livraison', status: 'todo', date: '', kind: 'delivery' },
  { id: crypto.randomUUID(), label: "Facture d'acompte envoyée", status: 'todo', date: '', kind: 'invoice_sent', paymentScheduleIndex: 0 },
  { id: crypto.randomUUID(), label: 'Acompte reçu', status: 'todo', date: '', kind: 'payment_received', paymentScheduleIndex: 0 },
  { id: crypto.randomUUID(), label: 'Facture finale envoyée', status: 'todo', date: '', kind: 'invoice_sent', paymentScheduleIndex: -1 },
  { id: crypto.randomUUID(), label: 'Paiement final reçu', status: 'todo', date: '', kind: 'payment_received', paymentScheduleIndex: -1 },
];

const normalizeMilestone = (milestone: Project['milestones'][number]): Project['milestones'][number] => {
  const label =
    milestone.label === 'Projet créé'
      ? 'Cadrage initial validé'
      : milestone.label === 'Facture finale payée'
        ? 'Paiement final reçu'
        : milestone.label === 'Paiement reçu' &&
            !milestone.quoteId &&
            (milestone.paymentScheduleIndex ?? -1) === -1
          ? 'Paiement final reçu'
        : milestone.label;
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
              : label === 'Livraison'
                ? 'delivery'
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
    quoteId: milestone.quoteId || '',
    addOnId: milestone.addOnId || '',
  };
};

const normalizeProjectSupplements = (item: Project): Project['projectSupplements'] =>
  (item.projectSupplements || []).map((supplement) => ({
    id: supplement.id || crypto.randomUUID(),
    title: supplement.title || 'Supplément',
    amountExVat: Number(supplement.amountExVat || 0),
    createdAt: supplement.createdAt || toIsoDate(item.createdAt) || new Date().toISOString().slice(0, 10),
    description: supplement.description || '',
  }));

const normalizeProject = (item: Project): Project => ({
  ...item,
  description: item.description || '',
  notes: item.notes || '',
  projectSupplements: normalizeProjectSupplements(item),
  sourceType: item.sourceType || 'custom',
  clientId: item.clientId || '',
  clientName: item.clientName || '',
  color: item.color || '#e96a5f',
  status: item.status || 'in_progress',
  budgetExVat: Number(item.budgetExVat || 0),
  invoicedExVat: Number(item.invoicedExVat || 0),
  paidExVat: Number(item.paidExVat || 0),
  billingWaivedExVat: Number(item.billingWaivedExVat || 0),
  hourlyRate: Number(item.hourlyRate || 0),
  startedAt: item.startedAt || toIsoDate(item.createdAt),
  dueDate: item.dueDate || '',
  closedAt: item.closedAt || '',
  nextAction: item.nextAction || '',
  sessions: item.sessions || [],
  totalTrackedSeconds: Number(item.totalTrackedSeconds || 0),
  activeStartedAt: item.activeStartedAt || '',
  activeSessionStartedAt: item.activeSessionStartedAt || '',
  activeSessionTitle: item.activeSessionTitle || '',
  activeSessionSeconds: Number(item.activeSessionSeconds || 0),
  milestones: (item.milestones?.length ? item.milestones : defaultMilestones()).map(normalizeMilestone),
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
      sessions: [],
      totalTrackedSeconds: 0,
      activeStartedAt: '',
      activeSessionStartedAt: '',
      activeSessionTitle: '',
      activeSessionSeconds: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return normalizeProject({
      id: docRef.id,
      userId,
      ...payload,
      sessions: [],
      totalTrackedSeconds: 0,
      activeStartedAt: '',
      activeSessionStartedAt: '',
      activeSessionTitle: '',
      activeSessionSeconds: 0,
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
