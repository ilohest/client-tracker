// useAiNoteGenerator.ts

import { ref } from "vue";
import { generateStructuredData } from "../services/aiService";
import type { AiGeneratedNote } from "../types/ai";
import { useToast } from "primevue/usetoast";

export function useAiNoteGenerator() {
  const loading = ref(false);
  const toast = useToast();

  // CLAMPING : Fonction de sécurité pour les nombres
  const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);

  const generateNoteFromInput = async (
    rawInput: string,
  ): Promise<AiGeneratedNote | null> => {
    loading.value = true;

    try {
      const systemContext =
        "Analyse l'input et crée une note structurée. Déduis la priorité (1-3).";
      const structureExample = `{ "title": "...", "summary": "...", "tags": ["tag1"], "priorityScore": 2 }`;

      const data = await generateStructuredData<AiGeneratedNote>(
        rawInput,
        systemContext,
        structureExample,
      );

      // --- SAFETY LAYER (Ta spécification) ---
      // 1. Clamping de la priorité (L'IA peut hallucciner un 10)
      data.priorityScore = clamp(data.priorityScore || 1, 1, 3);

      // 2. Validation des tags (Max 5 tags pour pas casser l'UI)
      if (data.tags && data.tags.length > 5) {
        data.tags = data.tags.slice(0, 5);
      }

      // 3. Fallback Title
      if (!data.title) data.title = "Nouvelle Note (IA)";

      return data;
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Erreur IA",
        detail: "Impossible de générer la note.",
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    generateNoteFromInput,
  };
}
