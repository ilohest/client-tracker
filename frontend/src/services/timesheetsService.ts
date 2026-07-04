import type { Timesheet, TimesheetInput, TimesheetSession } from '@client-tracker/contracts';
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

const normalizeTimesheet = (item: Timesheet): Timesheet => ({
  ...item,
  quoteId: item.quoteId || '',
  quoteRef: item.quoteRef || '',
  clientId: item.clientId || '',
  clientName: item.clientName || '',
  projectStartDate: item.projectStartDate || '',
  activeStartedAt: item.activeStartedAt || '',
  sessions: item.sessions || [],
  totalTrackedSeconds: Number(item.totalTrackedSeconds || 0),
});

export const timesheetsService = {
  async fetchAll(): Promise<Timesheet[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'timesheets'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => normalizeTimesheet({ id: item.id, ...item.data() } as Timesheet))
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  },

  async create(payload: TimesheetInput): Promise<Timesheet> {
    const userId = ensureUser();
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'timesheets'), {
      ...payload,
      userId,
      totalTrackedSeconds: 0,
      sessions: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return normalizeTimesheet({
      id: docRef.id,
      userId,
      ...payload,
      totalTrackedSeconds: 0,
      sessions: [],
      createdAt: now,
      updatedAt: now,
    });
  },

  async update(id: string, payload: Partial<Timesheet>): Promise<void> {
    await updateDoc(doc(db, 'timesheets', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  },

  async startTimer(id: string, startedAt: string, projectStartDate?: string): Promise<void> {
    const payload: Partial<Timesheet> = {
      activeStartedAt: startedAt,
    };
    if (projectStartDate) payload.projectStartDate = projectStartDate;

    await updateDoc(doc(db, 'timesheets', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  },

  async stopTimer(
    id: string,
    sessions: TimesheetSession[],
    totalTrackedSeconds: number,
  ): Promise<void> {
    await updateDoc(doc(db, 'timesheets', id), {
      activeStartedAt: '',
      sessions,
      totalTrackedSeconds,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'timesheets', id));
  },
};
