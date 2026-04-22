import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  applyActionCode,
  confirmPasswordReset,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

const getActionCodeSettings = () => ({
  url: `${window.location.origin}/auth/action`,
  handleCodeInApp: true,
});

export const authService = {
  /**
   * Connexion email/password
   */
  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  },

  /**
   * Inscription : crée l'utilisateur Firebase Auth + met à jour le displayName + envoie l'email de vérification
   * Retourne le User créé
   */
  async register(email: string, password: string, name: string): Promise<User> {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });

    await sendEmailVerification(user, getActionCodeSettings());

    return user;
  },

  async resendVerificationEmail(user: User): Promise<void> {
    await sendEmailVerification(user, getActionCodeSettings());
  },

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    await signOut(auth);
  },

  /**
   * Met à jour le displayName Firebase Auth
   */
  async updateDisplayName(user: User, displayName: string): Promise<void> {
    await updateProfile(user, { displayName });
  },

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email, getActionCodeSettings());
  },

  /**
   * Vérifie et applique un code d'action (validation email)
   */
  async verifyEmailCode(code: string): Promise<void> {
    await applyActionCode(auth, code);
  },

  /**
   * Confirme la réinitialisation du mot de passe
   */
  async confirmResetPassword(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(auth, code, newPassword);
  },

  /**
   * Supprime le compte Firebase Auth
   */
  async deleteAuthAccount(user: User): Promise<void> {
    await deleteUser(user);
  },
};
