<!-- AuthAction.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import AuthLayout from "../../layouts/AuthLayout.vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import ProgressSpinner from "primevue/progressspinner";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Paramètres de l'URL Firebase
const mode = route.query.mode as string; // 'verifyEmail' | 'resetPassword'
const actionCode = route.query.oobCode as string;

const loading = ref(true);
const success = ref(false);
const error = ref<string | null>(null);

// Pour le Reset Password
const newPassword = ref("");
const showResetForm = ref(false);

onMounted(async () => {
  // --- CAS 1 : Pas de code (Redirection post-validation Firebase) ---
  if (!actionCode) {
    // On vérifie si l'utilisateur est déjà connecté et validé
    if (authStore.user) {
      await authStore.user.reload(); // Rafraîchit le statut depuis Firebase
      if (authStore.user.emailVerified) {
        // C'est bon, Firebase l'a déjà fait pour nous !
        success.value = true;
        loading.value = false;
        return;
      }
    }

    error.value = "Lien incomplet ou déjà utilisé.";
    loading.value = false;
    return;
  }

  // --- CAS 2 : Code présent (Vérification par l'app) ---

  // MODE : VÉRIFICATION EMAIL
  if (mode === "verifyEmail") {
    const isOk = await authStore.verifyEmailCode(actionCode);
    if (isOk) {
      success.value = true;
    } else {
      // Si le code échoue, on re-vérifie quand même le statut user (Plan B)
      if (authStore.user) {
        await authStore.user.reload();
        if (authStore.user.emailVerified) {
          success.value = true;
          loading.value = false;
          return;
        }
      }
      error.value =
        authStore.error || "Ce lien a expiré ou a déjà été utilisé.";
    }
    loading.value = false;
  }

  // MODE : RESET PASSWORD
  else if (mode === "resetPassword") {
    showResetForm.value = true;
    loading.value = false;
  } else {
    error.value = "Action inconnue.";
    loading.value = false;
  }
});

const handlePasswordReset = async () => {
  if (!newPassword.value) return;
  loading.value = true;
  const isOk = await authStore.confirmResetPassword(
    actionCode,
    newPassword.value,
  );
  loading.value = false;

  if (isOk) {
    showResetForm.value = false;
    success.value = true;
  } else {
    error.value = authStore.error;
  }
};
</script>

<template>
  <AuthLayout>
    <div v-if="loading" class="text-center py-12">
      <ProgressSpinner style="width: 50px; height: 50px" />
      <p class="text-surface-dark/60 mt-4 text-sm">Vérification en cours...</p>
    </div>

    <div v-else-if="success" class="text-center animate-fade-in">
      <div
        class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"
      >
        <span class="material-symbols-outlined text-3xl">check_circle</span>
      </div>
      <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
        {{
          mode === "resetPassword"
            ? "Mot de passe modifié !"
            : "Email vérifié !"
        }}
      </h2>
      <p class="text-surface-dark/60 font-body mb-8">
        {{
          mode === "resetPassword"
            ? "Vous pouvez vous connecter."
            : "Votre compte est maintenant actif."
        }}
      </p>
      <Button
        label="Accéder à mon espace"
        class="w-full font-bold shadow-lg shadow-primary/20"
        @click="router.push(mode === 'resetPassword' ? '/login' : '/')"
      />
    </div>

    <div v-else-if="showResetForm" class="animate-fade-in">
      <div class="mb-6">
        <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
          Nouveau mot de passe
        </h2>
        <p class="text-surface-dark/60 font-body text-sm">
          Choisissez un mot de passe sécurisé.
        </p>
      </div>

      <form @submit.prevent="handlePasswordReset" class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-surface-dark/80"
            >Nouveau mot de passe</label
          >
          <Password
            v-model="newPassword"
            toggleMask
            class="w-full"
            inputClass="w-full"
            :feedback="true"
          />
        </div>
        <Button
          label="Confirmer le changement"
          type="submit"
          :loading="loading"
          class="w-full font-bold"
        />
      </form>
    </div>

    <div v-else class="text-center">
      <div
        class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600"
      >
        <span class="material-symbols-outlined text-3xl">cancel</span>
      </div>
      <h2 class="text-xl font-bold text-surface-dark mb-2">Lien invalide</h2>
      <p class="text-red-600 mb-8">{{ error }}</p>
      <Button label="Retour à l'accueil" text @click="router.push('/')" />
    </div>
  </AuthLayout>
</template>
