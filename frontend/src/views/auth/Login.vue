<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import { useToast } from "primevue/usetoast";
import AuthLayout from "../../layouts/AuthLayout.vue"; // Import du layout

// Components PrimeVue
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";

const email = ref("");
const password = ref("");
const loading = ref(false);
const rememberMe = ref(false);

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

const handleLogin = async () => {
  if (!email.value || !password.value) return;

  loading.value = true;
  // Note: authStore.loginUser doit retourner un booléen ou throw
  const success = await authStore.loginUser(email.value, password.value);
  loading.value = false;

  if (success) {
    router.push("/");
  } else {
    toast.add({
      severity: "error",
      summary: "Échec de connexion",
      detail: authStore.error || "Identifiants incorrects.",
      life: 3000,
    });
  }
};
</script>

<template>
  <AuthLayout>
    <div class="mb-8">
      <h2 class="text-2xl font-bold font-heading text-surface-dark mb-2">
        Bon retour !
      </h2>
      <p class="text-surface-dark/60 font-body text-sm">
        Saisissez vos identifiants pour accéder à votre compte.
      </p>
    </div>

    <form @submit.prevent="handleLogin" class="flex flex-col gap-5">
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
          :class="{ 'p-invalid': authStore.error }"
          autocomplete="username"
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <label for="password" class="text-sm font-bold text-surface-dark/80"
            >Mot de passe</label
          >
          <router-link
            to="/forgot-password"
            class="text-xs text-primary font-bold hover:underline"
          >
            Mot de passe oublié ?
          </router-link>
        </div>
        <Password
          id="password"
          v-model="password"
          :feedback="false"
          toggleMask
          placeholder="••••••••"
          inputClass="w-full"
          class="w-full"
          autocomplete="current-password"
        />
      </div>

      <div class="flex items-center gap-2">
        <Checkbox v-model="rememberMe" binary inputId="remember" />
        <label
          for="remember"
          class="text-sm text-surface-dark/70 cursor-pointer select-none"
          >Se souvenir de moi</label
        >
      </div>

      <Button
        type="submit"
        label="Se connecter"
        iconPos="right"
        :loading="loading"
        class="w-full font-bold shadow-lg shadow-primary/20"
      >
        <template #icon><span class="material-symbols-outlined text-lg">arrow_forward</span></template>
      </Button>
    </form>

    
  </AuthLayout>
</template>
