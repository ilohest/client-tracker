<script setup lang="ts">
import Button from 'primevue/button';

defineProps<{
  canManage?: boolean;
}>();

const emit = defineEmits<{
  save: [];
  downloadPdf: [];
  duplicate: [];
  delete: [];
}>();
</script>

<template>
  <div
    class="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
  >
    <div class="flex items-center gap-1">
      <Button
        v-if="canManage"
        text
        severity="secondary"
        class="!rounded-xl"
        @click="emit('duplicate')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
        Dupliquer
      </Button>
      <Button
        v-if="canManage"
        text
        severity="danger"
        class="!rounded-xl"
        @click="emit('delete')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
        Supprimer
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <Button severity="secondary" outlined class="!rounded-xl" @click="emit('downloadPdf')">
        <template #icon><span class="material-symbols-outlined text-lg">download</span></template>
        Générer le PDF
      </Button>
      <Button class="!rounded-xl !px-5 font-semibold" @click="emit('save')">
        <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        Sauvegarder
      </Button>
    </div>
  </div>
</template>
