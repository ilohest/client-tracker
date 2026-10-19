<!-- WelcomeCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "../../stores/authStore";

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
  <div class="flex flex-col gap-1 px-1">
    <span class="text-xs font-medium capitalize text-surface-dark/45">{{ today }}</span>
    <h2 class="font-heading text-2xl font-semibold leading-tight text-surface-dark">
      {{ greeting }}, {{ userName }}
    </h2>
    <p class="mt-1 max-w-md text-sm text-surface-dark/55">
      Voici un aperçu de votre activité : devis en cours, projets et chrono.
    </p>
  </div>
</template>
