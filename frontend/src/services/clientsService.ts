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

export const clientsService = {
  async fetchAll(): Promise<Client[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'clients'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Client)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
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

    return {
      id: docRef.id,
      userId,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
  },

  async update(id: string, payload: ClientInput): Promise<Client> {
    const userId = ensureUser();
    await updateDoc(doc(db, 'clients', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    return {
      id,
      userId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
