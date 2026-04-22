<!-- ThemeImporter.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Textarea from "primevue/textarea";
import Tag from "primevue/tag";

const emit = defineEmits(["close"]);
const toast = useToast();
const importContent = ref("");
const isLoading = ref(false);

const handleImport = async () => {
  isLoading.value = true;
  try {
    const parsed = JSON.parse(importContent.value);

    // Appel à notre plugin Vite local
    const response = await fetch("/api/dev/save-theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) throw new Error("Erreur écriture fichier");

    toast.add({
      severity: "success",
      summary: "Succès",
      detail: "Thème mis à jour (Hot Reload activé).",
      life: 3000,
    });
    emit("close");

    // Vite détectera le changement de fichier et fera un HMR automatique !
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Erreur",
      detail: "Impossible de modifier les fichiers (êtes-vous en dev ?)",
      life: 3000,
    });
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700 mb-8 relative"
  >
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-white font-bold flex items-center gap-2">
        <span class="material-symbols-outlined text-green-400">code</span> Import JSON (PickColor)
      </h3>
      <Tag value="DevTools" severity="warning" />
    </div>

    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-2 gap-2"
    >
      <p class="text-slate-400 text-sm">
        Collez ici le JSON pour tester une palette.
      </p>

      <a
        href="https://prodromou.fun/tools/pick-color"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors font-medium"
      >
        <span>Générer sur PickColor</span>
        <span class="material-symbols-outlined text-[10px]">open_in_new</span>
      </a>
    </div>

    <Textarea
      v-model="importContent"
      rows="4"
      class="w-full font-mono text-xs bg-slate-950 text-green-400 border-slate-800 mb-4 focus:ring-green-500/50"
      placeholder='{ "palette": ["#6366f1", "#64748b"], "neutrals": {...} }'
    />

    <div class="flex justify-end gap-3">
      <Button
        label="Annuler"
        text
        severity="secondary"
        class="!text-slate-400"
        @click="$emit('close')"
      />
      <Button label="Appliquer" @click="handleImport">
        <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
      </Button>
    </div>
  </div>
</template>
