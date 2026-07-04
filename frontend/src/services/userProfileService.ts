import type { UserProfile } from "@client-tracker/contracts";


import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";


export const userProfileService = {
  /**
   * Récupère ou crée le profil utilisateur après connexion
   */
  async syncProfile(uid: string, email: string): Promise<UserProfile | null> {
    
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await setDoc(docRef, { lastLoginAt: serverTimestamp() }, { merge: true });
        return { ...docSnap.data(), email } as UserProfile;
      } else {
        const newProfile: any = {
          uid,
          email,
          contactEmail: "",
          jobTitle: "",
          hourlyRate: 0,
          role: "user",
          color: "#e96a5f",
          address: "",
          billingStreet: "",
          billingStreetNumber: "",
          billingPostalCode: "",
          billingCity: "",
          website: "",
          logoUrl: "",
          logoPath: "",
          quotePdfTextColor: "#23262f",
          quotePdfTitleColor: "#23262f",
          quotePdfAccentColor: "#14161f",
          quotePdfHeadingFont: "Fraunces",
          quotePdfHeadingFontVariant: "600",
          quotePdfHeadingFontGoogleFamily: "Fraunces:opsz,wght@9..144,600",
          quotePdfBodyFont: "Inter",
          quotePdfBodyFontVariant: "regular",
          quotePdfBodyFontGoogleFamily: "Inter:wght@400",
          billingCountry: "BE",
          vatNumber: "",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(docRef, newProfile);
        return newProfile as UserProfile;
      }
    } catch (e) {
      console.error("Erreur sync profil Firestore", e);
      return null;
    }
    
  },

  /**
   * Crée un profil complet (inscription)
   */
  async createProfile(profile: UserProfile): Promise<void> {
    
    await setDoc(doc(db, "users", profile.uid), profile);
    
  },

  /**
   * Met à jour le profil utilisateur
   */
  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    
    await updateDoc(doc(db, "users", uid), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    
  },

  /**
   * Supprime le profil Firestore
   */
  async deleteProfile(uid: string): Promise<void> {
    
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (e) {
      console.warn("Erreur suppression profil:", e);
    }
    
  },
};
