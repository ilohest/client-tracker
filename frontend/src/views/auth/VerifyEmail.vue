<!-- VerifyEmail.vue -->

<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../../stores/authStore";
import { useToast } from "primevue/usetoast";
import AuthLayout from "../../layouts/AuthLayout.vue";
import Button from "primevue/button";

const authStore = useAuthStore();
const toast = useToast();
const loading = ref(false);

const resendEmail = async () => {
  if (!authStore.user) return;
  loading.value = true;
  try {
    const success = await authStore.resendVerificationEmail();

    toast.add({
      severity: success ? "success" : "error",
      summary: success ? "Envoyé" : "Envoi impossible",
      detail: success
        ? "Un nouvel email de vérification a été envoyé."
        : authStore.error || "Impossible d'envoyer l'email.",
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
};

const checkVerification = async () => {
  // On recharge l'utilisateur pour voir si emailVerified est passé à true
  if (authStore.user) {
    await authStore.user.reload();
    if (authStore.user.emailVerified) {
      window.location.href = "/"; // Redirection forcée
    } else {
      toast.add({
        severity: "info",
        summary: "Pas encore...",
        detail: "Votre email n'est pas encore validé.",
        life: 3000,
      });
    }
  }
};
</script>

<template>
  <AuthLayout>
    <div class="text-center mb-8">
      <div
        class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary"
      >
        <span class="material-symbols-outlined text-2xl">mail</span>
      </div>
      <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
        Vérifiez vos emails
      </h2>
      <p class="text-surface-dark/60 font-body text-sm">
        Un lien de confirmation a été envoyé à
        <strong>{{ authStore.user?.email }}</strong
        >.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <Button
        label="J'ai cliqué sur le lien"
        class="w-full font-bold"
        @click="checkVerification"
      >
        <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
      </Button>

      <Button
        label="Renvoyer l'email"
        severity="secondary"
        text
        class="w-full"
        :loading="loading"
        @click="resendEmail"
      >
        <template #icon><span class="material-symbols-outlined text-lg">refresh</span></template>
      </Button>

      <div class="border-t border-surface-dark/10 my-2"></div>

      <Button
        label="Se déconnecter"
        severity="danger"
        text
        size="small"
        @click="authStore.logoutUser"
      />
    </div>
  </AuthLayout>
</template>
