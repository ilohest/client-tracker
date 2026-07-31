import type { Client, ClientDocument, ClientInput, ClientProject, OnboardingTaskStatus } from '@client-tracker/contracts';
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

const normalizeClientNotes = (item: Client): Client['clientNotes'] => {
  if (item.clientNotes?.length) return item.clientNotes;
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

/** Compatibilité avec l'ancien pipeline, qui mélangeait relation et étapes projet. */
const normalizeClientStage = (value: unknown): Client['stage'] => {
  if (['prospect', 'opportunity', 'active', 'recurring', 'paused', 'former'].includes(String(value))) {
    return value as Client['stage'];
  }
  if (value === 'lead') return 'prospect';
  if (value === 'quote_sent') return 'opportunity';
  if (value === 'done') return 'former';
  if (['quote_signed', 'content_pending', 'build_in_progress', 'review', 'launch'].includes(String(value))) {
    return 'active';
  }
  return 'prospect';
};

const normalizeClient = (item: Client): Client => ({
  ...item,
  stage: normalizeClientStage(item.stage),
  notes: item.notes || '',
  clientNotes: normalizeClientNotes(item),
  documents: item.documents || [],
  projects: item.projects || [],
  onboardingTasks: item.onboardingTasks || [],
});

export const clientsService = {
  async fetchAll(): Promise<Client[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'clients'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => normalizeClient({ id: item.id, ...item.data() } as Client))
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  },

  async create(payload: ClientInput): Promise<Client> {
    const userId = ensureUser();
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'clients'), {
      ...payload,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return normalizeClient({
      id: docRef.id,
      userId,
      ...payload,
      createdAt: now,
      updatedAt: now,
    } as Client);
  },

  async update(id: string, payload: ClientInput): Promise<Client> {
    const userId = ensureUser();
    await updateDoc(doc(db, 'clients', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    return normalizeClient({
      id,
      userId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Client);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'clients', id));
  },

  async updateStage(id: string, stage: Client['stage']): Promise<void> {
    await updateDoc(doc(db, 'clients', id), {
      stage,
      updatedAt: serverTimestamp(),
    });
  },

  async updateNotes(id: string, notes: string): Promise<void> {
    await updateDoc(doc(db, 'clients', id), {
      notes,
      updatedAt: serverTimestamp(),
    });
  },

  async updateClientNotes(id: string, clientNotes: Client['clientNotes']): Promise<void> {
    await updateDoc(doc(db, 'clients', id), {
      clientNotes,
      notes: '',
      updatedAt: serverTimestamp(),
    });
  },

  async updateProjectOnboardingTaskStatus(
    id: string,
    projects: ClientProject[],
    projectId: string,
    taskId: string,
    status: OnboardingTaskStatus,
  ): Promise<ClientProject[]> {
    const nextProjects = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            onboardingTasks: project.onboardingTasks.map((task) =>
              task.id === taskId ? { ...task, status } : task,
            ),
          }
        : project,
    );

    await updateDoc(doc(db, 'clients', id), {
      projects: nextProjects,
      updatedAt: serverTimestamp(),
    });

    return nextProjects;
  },

  async addProject(id: string, projects: ClientProject[], project: ClientProject): Promise<ClientProject[]> {
    const nextProjects = [...projects, project];
    await updateDoc(doc(db, 'clients', id), {
      projects: nextProjects,
      updatedAt: serverTimestamp(),
    });
    return nextProjects;
  },

  async updateDocuments(
    id: string,
    documents: ClientDocument[],
  ): Promise<ClientDocument[]> {
    await updateDoc(doc(db, 'clients', id), {
      documents,
      updatedAt: serverTimestamp(),
    });

    return documents;
  },
};
