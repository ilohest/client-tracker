<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../../stores/authStore";
import { useToast } from "primevue/usetoast";
import AuthLayout from "../../layouts/AuthLayout.vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

const email = ref("");
const loading = ref(false);
const sent = ref(false);

const authStore = useAuthStore();
const toast = useToast();

const handleReset = async () => {
  if (!email.value) return;
  loading.value = true;

  // Supposons une méthode resetPassword dans le store
  const success = await authStore.resetPassword(email.value);
  loading.value = false;

  if (success) {
    sent.value = true;
    toast.add({
      severity: "success",
      summary: "Email envoyé",
      detail: "Vérifiez votre boîte de réception.",
      life: 5000,
    });
  } else {
    toast.add({
      severity: "error",
      summary: "Erreur",
      detail: authStore.error,
      life: 3000,
    });
  }
};
</script>

<template>
  <AuthLayout>
    <div class="mb-8">
      <router-link
        to="/login"
        class="inline-flex items-center text-xs text-surface-dark/50 hover:text-primary mb-4 transition-colors"
      >
        <span class="material-symbols-outlined mr-1">arrow_back</span> Retour à la connexion
      </router-link>

      <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
        Réinitialisation
      </h2>
      <p class="text-surface-dark/60 font-body text-sm">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
    </div>

    <div
      v-if="sent"
      class="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-fade-in"
    >
      <div
        class="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3"
      >
        <span class="material-symbols-outlined text-xl">check</span>
      </div>
      <h3 class="font-bold text-green-800 mb-2">Lien envoyé !</h3>
      <p class="text-sm text-green-700">
        Si un compte existe avec l'adresse <strong>{{ email }}</strong
        >, vous recevrez les instructions sous peu.
      </p>
      <Button
        label="Retourner à la connexion"
        text
        class="mt-4 !text-green-700"
        @click="$router.push('/login')"
      />
    </div>

    <form v-else @submit.prevent="handleReset" class="flex flex-col gap-5">
      <div class="flex flex-col gap-2">
        <label for="email" class="text-sm font-bold text-surface-dark/80"
          >Email</label
        >
        <InputText
          id="email"
          v-model="email"
          type="email"
          placeholder="exemple@domaine.com"
          class="w-full"
          required
        />
      </div>

      <Button
        type="submit"
        label="Envoyer le lien"
        :loading="loading"
        class="w-full font-bold"
      >
        <template #icon><span class="material-symbols-outlined text-lg">send</span></template>
      </Button>
    </form>
  </AuthLayout>
</template>
