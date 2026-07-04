import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/services/firebase';

const ensureUser = (): string => {
  if (!auth.currentUser) throw new Error('Utilisateur non connecté');
  return auth.currentUser.uid;
};

const sanitizeFileName = (name: string): string => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const profileLogoService = {
  async upload(file: File, previousPath?: string): Promise<{ logoUrl: string; logoPath: string }> {
    const userId = ensureUser();
    const safeName = sanitizeFileName(file.name || 'logo');
    const path = `users/${userId}/profile/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, { contentType: file.type || 'image/png' });
    const logoUrl = await getDownloadURL(storageRef);

    await updateDoc(doc(db, 'users', userId), {
      logoUrl,
      logoPath: path,
      updatedAt: serverTimestamp(),
    });

    if (previousPath && previousPath !== path) {
      try {
        await deleteObject(ref(storage, previousPath));
      } catch {
        // L'ancien fichier peut déjà avoir été supprimé ou venir d'une URL externe historique.
      }
    }

    return { logoUrl, logoPath: path };
  },
};
