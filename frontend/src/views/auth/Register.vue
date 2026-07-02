<!-- Register.vue  -->

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import { useToast } from "primevue/usetoast";
import AuthLayout from "../../layouts/AuthLayout.vue";

import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";

const name = ref("");
const email = ref("");
const password = ref("");
const loading = ref(false);

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

const handleRegister = async () => {
  if (!email.value || !password.value || !name.value) return;

  loading.value = true;
  // Supposons que ton authStore a une méthode registerUser
  const success = await authStore.registerUser(
    email.value,
    password.value,
    name.value,
  );
  loading.value = false;

  if (success) {
    toast.add({
      severity: "success",
      summary: "Bienvenue !",
      detail: "Votre compte a été créé. Vérifiez maintenant votre email.",
      life: 3000,
    });
    router.push("/verify-email");
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
      <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
        Créer un compte
      </h2>
      <p class="text-surface-dark/60 font-body text-sm">
        Rejoignez Devisio en quelques secondes.
      </p>
    </div>

    <form @submit.prevent="handleRegister" class="flex flex-col gap-5">
      <div class="flex flex-col gap-2">
        <label for="name" class="text-sm font-bold text-surface-dark/80"
          >Nom complet</label
        >
        <InputText
          id="name"
          v-model="name"
          class="w-full"
          placeholder="John Doe"
          autocomplete="name"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="email" class="text-sm font-bold text-surface-dark/80"
          >Email</label
        >
        <InputText
          id="email"
          v-model="email"
          type="email"
          class="w-full"
          placeholder="exemple@domaine.com"
          autocomplete="email"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="password" class="text-sm font-bold text-surface-dark/80"
          >Mot de passe</label
        >
        <Password
          id="password"
          v-model="password"
          toggleMask
          placeholder="••••••••"
          inputClass="w-full"
          class="w-full"
          :feedback="true"
          promptLabel="Choisissez un mot de passe"
          weakLabel="Faible"
          mediumLabel="Moyen"
          strongLabel="Fort"
        />
      </div>

      <Button
        type="submit"
        label="S'inscrire"
        :loading="loading"
        class="w-full font-bold mt-2"
      />
    </form>

    <div class="mt-8 text-center">
      <p class="text-sm text-surface-dark/60">
        Déjà un compte ?
        <router-link
          to="/login"
          class="text-primary font-bold hover:underline ml-1"
        >
          Se connecter
        </router-link>
      </p>
    </div>
  </AuthLayout>
</template>
