

 // frontend/src/services/userService.ts

import { db } from "@/services/firebase";
import { collection, getDocs } from "firebase/firestore";

import type { AppUser } from "@client-tracker/contracts";

export const userService = {
  async fetchAll(): Promise<AppUser[]> {
    
    // --- MODE SERVERLESS (SDK FIREBASE) ---
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    })) as AppUser[];
    
  }
};