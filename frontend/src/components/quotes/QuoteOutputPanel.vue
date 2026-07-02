<script setup lang="ts">
import type { QuoteLanguage } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

defineProps<{
  language: QuoteLanguage;
  emailSubject: string;
  emailBody: string;
}>();

const emit = defineEmits<{
  'update:emailSubject': [value: string];
  'update:emailBody': [value: string];
  copyEmailSubject: [];
  copyEmailBody: [];
}>();
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-6 h-full">
    <div class="rounded-3xl bg-white border border-surface-dark/5 p-5">
      <div class="mb-3">
        <h3 class="font-heading font-bold text-surface-dark">Mail d’envoi</h3>
      </div>
      <div class="space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="text-sm font-medium text-surface-dark">Objet</label>
            <Button text severity="secondary" size="small" @click="emit('copyEmailSubject')">
              <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
            </Button>
          </div>
          <InputText
            :model-value="emailSubject"
            class="w-full"
            @update:model-value="emit('update:emailSubject', $event || '')"
          />
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="text-sm font-medium text-surface-dark">Contenu du mail</label>
            <Button text severity="secondary" size="small" @click="emit('copyEmailBody')">
              <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
            </Button>
          </div>
          <Textarea
            :model-value="emailBody"
            rows="12"
            class="w-full"
            @update:model-value="emit('update:emailBody', $event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>
