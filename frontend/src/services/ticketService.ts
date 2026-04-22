// frontend/src/services/ticketService.ts


import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';


export interface TicketPayload {
  subject: string;
  message: string;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Soumet un ticket de support
 */
export const submitTicket = async (payload: TicketPayload) => {
  
  // --- MODE SERVERLESS (FIREBASE DIRECT) ---
  const user = auth.currentUser;
  if (!user) throw new Error("Utilisateur non authentifié.");

  const ticketData = {
    ...payload,
    userId: user.uid,
    userEmail: user.email,
    status: 'open',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'tickets'), ticketData);

  return { 
    id: docRef.id, 
    ...ticketData, 
    createdAt: new Date().toISOString() 
  };
  
};