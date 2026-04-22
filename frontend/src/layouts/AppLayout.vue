<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "primevue/usetoast"; // <--- Import
import DefaultLayout from "./DefaultLayout.vue";
import CanvasLayout from "./CanvasLayout.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast(); // <--- Init

const layout = computed(() => {
  return route.meta.layout === "canvas" ? CanvasLayout : DefaultLayout;
});

// SURVEILLANCE DES ERREURS DE NAVIGATION
watch(
  () => route.query.error,
  (error) => {
    if (error === "forbidden") {
      toast.add({
        severity: "error",
        summary: "Accès Refusé",
        detail: "Vous n'avez pas les droits administrateur.",
        life: 4000,
      });

      // Nettoyer l'URL pour ne pas réafficher l'erreur au refresh
      router.replace({ query: { ...route.query, error: undefined } });
    }
  },
  { immediate: true },
);
</script>

<template>
  <component :is="layout" />
</template>
