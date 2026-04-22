// announcementsService.ts

import type { Announcement } from "@client-tracker/contracts";


import { 
  collection, addDoc, getDocs, query, orderBy, limit 
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";


export const announcementsService = {
  async fetchLatest(): Promise<Announcement[]> {
    
    const q = query(
      collection(db, "announcements"),
      orderBy("date", "desc"),
      limit(10)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
    
  },

  async create(content: string): Promise<void> {
    
    if (!auth.currentUser) return;
    await addDoc(collection(db, "announcements"), {
      content,
      date: new Date().toISOString(),
      author: auth.currentUser.email
    });
    
  }
};