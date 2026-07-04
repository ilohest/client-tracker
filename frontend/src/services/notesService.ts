//notesService.ts

// frontend/src/services/notesService.ts

import type { Note } from "@client-tracker/contracts";


// --- IMPORTS SERVERLESS (FIREBASE) ---
import { 
  collection, addDoc, deleteDoc,
  doc, query, where, getDocs,
  serverTimestamp, updateDoc 
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";

const ensureUser = (): string => {
  if (!auth.currentUser) throw new Error("Utilisateur non connecté");
  return auth.currentUser.uid;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === "string" || value instanceof Date) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsed = value.toDate().getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof value.seconds === "number"
  ) {
    return value.seconds * 1000;
  }
  return 0;
};

export const notesService = {
  /**
   * Récupère toutes les notes de l'utilisateur
   */
  async fetchAll(): Promise<Note[]> {
    const userId = ensureUser();
    
    const q = query(
      collection(db, "notes"),
      where("userId", "==", userId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }) as Note)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    
  },

  /**
   * Crée une nouvelle note
   */
  async create(content: string): Promise<Note> {
    const userId = ensureUser();
    const now = new Date().toISOString();

    const newNoteData = {
      content,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    // Pour Firestore, on utilise serverTimestamp() pour la DB
    const dbData = { ...newNoteData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    
    const docRef = await addDoc(collection(db, "notes"), dbData);
    
    // On retourne l'objet complet tel qu'attendu par l'UI
    return { id: docRef.id, ...newNoteData } as Note;
    
  },

  /**
   * Supprime une note
   */
  async delete(id: string): Promise<void> {
    
    await deleteDoc(doc(db, "notes", id));
    
  },

 /**
   * Met à jour une note
   */
  async update(id: string, content: string): Promise<Note> {
    ensureUser();

    // --- MODE SERVERLESS (FIREBASE) ---
    const docRef = doc(db, "notes", id);
    await updateDoc(docRef, { 
      content, 
      updatedAt: serverTimestamp() 
    });
    
    // On retourne une simulation de l'objet mis à jour pour l'UI
    return { id, content, updatedAt: new Date().toISOString() } as unknown as Note;
    
  }
};
