// clipboard.ts

/**
 * Copie un texte dans le presse-papier de l'utilisateur.
 * @param text Le contenu à copier
 * @returns Promise<boolean> Succès ou échec
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Échec de la copie :", err);
    return false;
  }
};
