//notesService.ts

// frontend/src/services/notesService.ts

import type { Note } from "@client-tracker/contracts";


// --- IMPORTS SERVERLESS (FIREBASE) ---
import { 
  getFirestore, collection, addDoc, deleteDoc, 
  doc, query, where, orderBy, getDocs, 
  serverTimestamp, updateDoc 
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";


export const notesService = {
  /**
   * Récupère toutes les notes de l'utilisateur
   */
  async fetchAll(): Promise<Note[]> {
    
    if (!auth.currentUser) return [];
    
    const q = query(
      collection(db, "notes"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Note));
    
  },

  /**
   * Crée une nouvelle note
   */
  async create(content: string): Promise<Note> {
    
    if (!auth.currentUser) throw new Error("Non connecté");

    const newNoteData = {
      content,
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString() // On utilise ISO pour le retour immédiat
    };

    // Pour Firestore, on utilise serverTimestamp() pour la DB
    const dbData = { ...newNoteData, createdAt: serverTimestamp() };
    
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