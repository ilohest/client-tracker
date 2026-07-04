import type { Quote, QuoteInput, QuoteStatus } from '@client-tracker/contracts';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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

export const quotesService = {
  async fetchAll(): Promise<Quote[]> {
    const userId = ensureUser();
    const snapshot = await getDocs(query(collection(db, 'quotes'), where('userId', '==', userId)));

    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Quote)
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  },

  async create(payload: QuoteInput & Pick<Quote, 'subtotal' | 'totalWithVat'>): Promise<Quote> {
    const userId = ensureUser();
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'quotes'), {
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

  async update(
    id: string,
    payload: QuoteInput & Pick<Quote, 'subtotal' | 'totalWithVat'>,
  ): Promise<Quote> {
    const userId = ensureUser();
    const docRef = doc(db, 'quotes', id);
    const existingSnapshot = await getDoc(docRef);
    const existing = existingSnapshot.exists() ? (existingSnapshot.data() as Partial<Quote>) : {};
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

  async setStatus(id: string, status: QuoteStatus): Promise<void> {
    await updateDoc(doc(db, 'quotes', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'quotes', id));
  },
};
