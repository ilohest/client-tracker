<script setup lang="ts">
import Button from 'primevue/button';

withDefaults(
  defineProps<{
    /** Affiche Dupliquer / Supprimer (une entrée existante est sélectionnée). */
    canDuplicate?: boolean;
    canDelete?: boolean;
    /** Affiche le bouton d'aperçu PDF (page Devis uniquement). */
    showPdf?: boolean;
    hasUnsavedChanges?: boolean;
    /** Déclenche l'animation de rappel quand une action est bloquée par des modifs non sauvées. */
    attention?: boolean;
  }>(),
  {
    canDuplicate: false,
    canDelete: false,
    showPdf: false,
    hasUnsavedChanges: false,
    attention: false,
  },
);

const emit = defineEmits<{
  save: [];
  discard: [];
  downloadPdf: [];
  duplicate: [];
  delete: [];
}>();
</script>

<template>
  <div
    class="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
    :class="{ 'action-bar-nudge': attention }"
  >
    <div class="flex items-center gap-1">
      <Button
        v-if="canDuplicate"
        text
        severity="secondary"
        class="!rounded-xl"
        label="Dupliquer"
        @click="emit('duplicate')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
      </Button>
      <Button
        v-if="canDelete"
        text
        severity="danger"
        class="!rounded-xl"
        label="Supprimer"
        @click="emit('delete')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
      </Button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button
        v-if="hasUnsavedChanges"
        text
        severity="secondary"
        class="!rounded-xl"
        label="Annuler"
        @click="emit('discard')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">undo</span></template>
      </Button>
      <Button
        v-if="showPdf"
        severity="secondary"
        outlined
        class="!rounded-xl"
        label="Prévisualiser"
        @click="emit('downloadPdf')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">visibility</span></template>
      </Button>
      <Button
        class="!rounded-xl !px-5 font-semibold"
        label="Sauvegarder"
        :disabled="!hasUnsavedChanges"
        @click="emit('save')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes action-bar-nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-5px);
  }
  40% {
    transform: translateX(5px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
}

.action-bar-nudge {
  animation: action-bar-nudge 0.46s ease-in-out;
}
</style>
