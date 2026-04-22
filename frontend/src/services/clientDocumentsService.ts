import type { ClientDocument } from '@client-tracker/contracts';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/services/firebase';

const ensureUser = (): string => {
  if (!auth.currentUser) throw new Error('Utilisateur non connecté');
  return auth.currentUser.uid;
};

const createDocumentId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const clientDocumentsService = {
  async upload(clientId: string, existingDocuments: ClientDocument[], file: File): Promise<ClientDocument[]> {
    const userId = ensureUser();
    const documentId = createDocumentId();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `clients/${userId}/${clientId}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(storageRef);

    const nextDocument: ClientDocument = {
      id: documentId,
      name: file.name,
      url,
      path,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    const nextDocuments = [nextDocument, ...existingDocuments];

    await updateDoc(doc(db, 'clients', clientId), {
      documents: nextDocuments,
      updatedAt: serverTimestamp(),
    });

    return nextDocuments;
  },

  async remove(clientId: string, existingDocuments: ClientDocument[], documentId: string): Promise<ClientDocument[]> {
    const documentToDelete = existingDocuments.find((item) => item.id === documentId);
    if (!documentToDelete) return existingDocuments;

    await deleteObject(ref(storage, documentToDelete.path));
    const nextDocuments = existingDocuments.filter((item) => item.id !== documentId);

    await updateDoc(doc(db, 'clients', clientId), {
      documents: nextDocuments,
      updatedAt: serverTimestamp(),
    });

    return nextDocuments;
  },
};
