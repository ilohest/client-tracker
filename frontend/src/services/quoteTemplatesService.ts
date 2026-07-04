import type { QuoteTemplate, QuoteTemplateInput } from '@client-tracker/contracts';
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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

export const quoteTemplatesService = {
  async fetchAll(): Promise<QuoteTemplate[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'quoteTemplates'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as QuoteTemplate)
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  },

  async create(payload: QuoteTemplateInput): Promise<QuoteTemplate> {
    const userId = ensureUser();
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'quoteTemplates'), {
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

  async update(id: string, payload: QuoteTemplateInput): Promise<QuoteTemplate> {
    const userId = ensureUser();
    const docRef = doc(db, 'quoteTemplates', id);
    const existingSnapshot = await getDoc(docRef);
    const existing = existingSnapshot.exists() ? (existingSnapshot.data() as Partial<QuoteTemplate>) : {};
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    return {
      id,
      userId,
      ...payload,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };
  },

  /** Promeut un template existant en base commune (migration de l'ancien flag isDefault). */
  async promoteToBase(id: string, name: string): Promise<void> {
    await updateDoc(doc(db, 'quoteTemplates', id), {
      kind: 'base',
      name,
      isDefault: deleteField(),
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'quoteTemplates', id));
  },
};
