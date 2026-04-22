<!-- AiGeneratorWidget.vue -->

<script setup lang="ts">
  import { ref } from "vue";
  import { useAuthStore } from "../../stores/authStore";
  import { useAiNoteGenerator } from "../../composables/useAiNoteGenerator";
  import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
  } from "firebase/firestore";
  import { useToast } from "primevue/usetoast";

  import { useNotesStore } from "../../stores/notesStore";

  // UI Components
  import Button from "primevue/button";
  import Textarea from "primevue/textarea";
  import Tag from "primevue/tag";
  import Rating from "primevue/rating";
  import Skeleton from "primevue/skeleton";

  // Store & Services
  const authStore = useAuthStore();
  const { generateNoteFromInput, loading } = useAiNoteGenerator();
  const db = getFirestore();
  const toast = useToast();

  const notesStore = useNotesStore();

  // State
  const userPrompt = ref("");
  const generatedData = ref<any | null>(null);

  // Actions
  const handleGenerate = async () => {
    if (!userPrompt.value.trim()) return;

    generatedData.value = null; // Reset
    const result = await generateNoteFromInput(userPrompt.value);

    if (result) {
      generatedData.value = result;
    }
  };

  const handleSaveToNotes = async () => {
    if (!authStore.user || !generatedData.value) return;

    // ON UTILISE LE STORE AU LIEU DE FIRESTORE DIRECTEMENT
    const noteContent = `${generatedData.value.title}\n\n${generatedData.value.summary}`;

    // Cette fonction gère déjà la logique (API ou Serverless) et le bon chemin
    const success = await notesStore.addNote(noteContent);

    if (success) {
      toast.add({
        severity: "success",
        summary: "Sauvegardé",
        detail: "Note créée depuis l'IA",
        life: 3000,
      });
      userPrompt.value = "";
      generatedData.value = null;
    } else {
      toast.add({
        severity: "error",
        summary: "Erreur",
        detail: "Sauvegarde impossible",
      });
    }
  };

  const handleDiscard = () => {
    generatedData.value = null;
    userPrompt.value = "";
  };
</script>

<template>
  <div
    class="h-full bg-white rounded-3xl p-6 shadow-sm border border-indigo-50 flex flex-col relative overflow-hidden group"
  >
    <div class="flex justify-between items-center mb-4 z-10">
      <h3 class="font-bold text-indigo-900 flex items-center gap-2">
        <span class="material-symbols-outlined text-indigo-500 animate-pulse"
          >auto_awesome</span
        >
        AI Assistant
      </h3>
      <Tag
        value="Gemini"
        severity="info"
        class="!bg-indigo-50 !text-indigo-600 !text-xs font-mono"
      />
    </div>

    <div
      v-if="!generatedData"
      class="flex-1 flex flex-col gap-3 z-10 transition-all"
    >
      <p class="text-sm text-slate-500">
        Décrivez une tâche ou une note en vrac, l'IA va la structurer pour vous.
      </p>
      <Textarea
        v-model="userPrompt"
        placeholder="Ex: Rdv demain 14h avec Marc pour le budget marketing, c'est super urgent..."
        class="w-full !text-sm flex-1 !bg-slate-50 hover:!bg-white focus:!bg-white transition-colors"
        :disabled="loading"
      />

      <div class="flex justify-end">
        <Button
          label="Générer"
          @click="handleGenerate"
          :loading="loading"
          :disabled="!userPrompt"
          severity="help"
          rounded
          size="small"
        >
          <template #icon><span class="material-symbols-outlined text-lg">auto_awesome</span></template>
        </Button>
      </div>
    </div>

    <div
      v-if="loading && !generatedData"
      class="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-6 gap-3"
    >
      <span class="material-symbols-outlined animate-spin text-indigo-500 text-2xl">progress_activity</span>
      <Skeleton width="80%" height="1rem" />
      <Skeleton width="60%" height="1rem" />
    </div>

    <div
      v-if="generatedData"
      class="flex-1 flex flex-col gap-3 z-10 animate-fade-in"
    >
      <div
        class="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex-1 flex flex-col gap-2"
      >
        <div class="flex justify-between items-start">
          <h4 class="font-bold text-indigo-900">{{ generatedData.title }}</h4>
          <Rating
            :modelValue="generatedData.priorityScore"
            readonly
            :cancel="false"
            :stars="3"
            class="scale-75 origin-right"
          />
        </div>
        <p class="text-sm text-slate-600 flex-1">{{ generatedData.summary }}</p>
        <div class="flex flex-wrap gap-1 mt-2">
          <Tag
            v-for="tag in generatedData.tags"
            :key="tag"
            :value="tag"
            severity="secondary"
            class="!text-xs"
          />
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <Button
          label="Rejeter"
          text
          severity="secondary"
          size="small"
          @click="handleDiscard"
        >
          <template #icon><span class="material-symbols-outlined text-lg">close</span></template>
        </Button>
        <Button
          label="Ajouter aux notes"
          severity="help"
          size="small"
          @click="handleSaveToNotes"
        >
          <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
        </Button>
      </div>
    </div>

    <div
      class="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-100/30 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-100/50 transition-colors duration-700"
    ></div>
  </div>
</template>

<style scoped>
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
