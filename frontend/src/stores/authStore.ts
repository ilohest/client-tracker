import { defineStore } from "pinia";
import { onAuthStateChanged, type User } from "firebase/auth";
import type { UserProfile } from "@client-tracker/contracts";
import { auth } from "../services/firebase";
import { authService } from "../services/authService";
import { userProfileService } from "../services/userProfileService";

export type { UserProfile };

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authInitialized: boolean;
  error: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    userProfile: null,
    loading: true,
    authInitialized: false,
    error: null,
  }),

  getters: {
    isLoggedIn: (state): boolean => !!state.user,
    isAdmin: (state): boolean => state.userProfile?.role === "admin",
  },

  actions: {
    async initAuth(): Promise<void> {
      if (this.authInitialized) return;

      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            this.user = user;
            await user.getIdToken(true);
            await this.fetchOrCreateProfile(user);
          } else {
            this.user = null;
            this.userProfile = null;
          }
          this.loading = false;
          this.authInitialized = true;
          resolve();
        });
      });
    },

    async fetchOrCreateProfile(user: User) {
      this.error = null;
      try {
        const profile = await userProfileService.syncProfile(user.uid, user.email || "");
        if (profile) {
          this.userProfile = profile;
        } else {
          this.error = "Impossible de charger le profil.";
        }
      } catch (e) {
        console.error("Erreur chargement profil:", e);
        this.error = "Erreur technique chargement profil.";
      }
    },

    async loginUser(email: string, password: string): Promise<boolean> {
      this.loading = true;
      this.error = null;
      try {
        await authService.login(email, password);
        return true;
      } catch (err: any) {
        console.error(err);
        this.error = "Email ou mot de passe incorrect.";
        this.loading = false;
        return false;
      }
    },

    async registerUser(email: string, password: string, name: string): Promise<boolean> {
      this.loading = true;
      this.error = null;
      try {
        const user = await authService.register(email, password, name);

        const newUserProfile: UserProfile = {
          uid: user.uid,
          email: user.email || email,
          displayName: name,
          role: "user",
          color: "#4C5EF7",
          address: "",
          billingStreet: "",
          billingStreetNumber: "",
          billingPostalCode: "",
          billingCity: "",
          website: "",
          logoUrl: "",
          billingCountry: "BE",
          vatNumber: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await userProfileService.createProfile(newUserProfile);

        this.user = user;
        this.userProfile = newUserProfile;
        return true;
      } catch (err: any) {
        console.error("Erreur inscription:", err);
        if (err.code === "auth/email-already-in-use") {
          this.error = "Cet email est déjà utilisé.";
        } else if (err.code === "auth/weak-password") {
          this.error = "Le mot de passe est trop faible.";
        } else {
          this.error = "Impossible de créer le compte.";
        }
        this.loading = false;
        return false;
      }
    },

    async logoutUser(): Promise<void> {
      try {
        await authService.logout();
        this.user = null;
        this.userProfile = null;
        window.location.href = "/login";
      } catch (err) {
        console.error(err);
      }
    },

    async updateUserProfile(payload: Partial<UserProfile> & { displayName: string }) {
      if (!this.user) return;

      await authService.updateDisplayName(this.user, payload.displayName);
      await userProfileService.updateProfile(this.user.uid, payload);

      this.user = { ...this.user, displayName: payload.displayName } as User;
      if (this.userProfile) {
        this.userProfile = {
          ...this.userProfile,
          ...payload,
        };
      }
    },

    async resetPassword(email: string): Promise<boolean> {
      this.error = null;
      try {
        await authService.resetPassword(email);
        return true;
      } catch (e: any) {
        this.error = "Email introuvable ou invalide.";
        return false;
      }
    },

    async verifyEmailCode(code: string) {
      this.loading = true;
      try {
        await authService.verifyEmailCode(code);
        if (this.user) await this.user.reload();
        return true;
      } catch (e) {
        this.error = "Code invalide ou expiré.";
        return false;
      } finally {
        this.loading = false;
      }
    },

    async resendVerificationEmail(): Promise<boolean> {
      this.error = null;
      if (!this.user) {
        this.error = "Aucun utilisateur connecté.";
        return false;
      }

      try {
        await authService.resendVerificationEmail(this.user);
        return true;
      } catch (e: any) {
        if (e?.code === "auth/too-many-requests") {
          this.error = "Trop de tentatives. Attendez quelques minutes avant de réessayer.";
        } else if (e?.code === "auth/unauthorized-continue-uri") {
          this.error = "Le domaine de redirection n'est pas autorisé dans Firebase Auth.";
        } else {
          this.error = "Impossible d'envoyer l'email de vérification.";
        }
        return false;
      }
    },

    async confirmResetPassword(code: string, newPassword: string) {
      this.loading = true;
      try {
        await authService.confirmResetPassword(code, newPassword);
        return true;
      } catch (e) {
        this.error = "Impossible de réinitialiser le mot de passe.";
        return false;
      } finally {
        this.loading = false;
      }
    },

    async deleteAccount() {
      if (!this.user) return;

      await userProfileService.deleteProfile(this.user.uid);
      await authService.deleteAuthAccount(this.user);

      this.user = null;
      this.userProfile = null;
      window.location.href = "/login";
    },
  },
});
