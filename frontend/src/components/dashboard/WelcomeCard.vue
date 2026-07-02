<!-- WelcomeCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import { useAuthStore } from "../../stores/authStore";

const router = useRouter();
const authStore = useAuthStore();
const userName = computed(() => authStore.user?.displayName || "Créateur");

const today = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const hour = new Date().getHours();
const greeting = computed(() =>
  hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir",
);
</script>

<template>
  <div
    class="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="z-10">
      <span
        class="mb-2 block text-xs font-bold uppercase tracking-widest text-surface-dark/40"
      >
        {{ today }}
      </span>
      <h2 class="font-heading text-3xl font-bold leading-tight text-surface-dark md:text-4xl">
        {{ greeting }}, <span class="text-primary">{{ userName }}</span> 👋
      </h2>
      <p class="mt-2 max-w-md text-surface-dark/60">
        Voici un aperçu de votre activité. Créez un devis, suivez vos clients et
        gardez le contrôle de votre pipeline.
      </p>

      <div class="mt-6 flex flex-wrap gap-3">
        <Button class="!rounded-xl !px-5 font-semibold" @click="router.push('/quotes')">
          <template #icon><span class="material-symbols-outlined text-lg">post_add</span></template>
          Nouveau devis
        </Button>
        <Button
          severity="secondary"
          outlined
          class="!rounded-xl !px-5 font-semibold"
          @click="router.push('/clients')"
        >
          <template #icon><span class="material-symbols-outlined text-lg">groups</span></template>
          Mes clients
        </Button>
      </div>
    </div>

    <div
      class="z-10 hidden shrink-0 rounded-2xl border border-surface-dark/5 bg-surface-light p-4 shadow-sm sm:block"
    >
      <img src="/img/logo.png" alt="Logo" class="h-16 w-16 object-contain" />
    </div>

    <div
      class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10 blur-3xl"
      style="background: radial-gradient(circle, var(--color-primary), transparent)"
    ></div>
  </div>
</template>
