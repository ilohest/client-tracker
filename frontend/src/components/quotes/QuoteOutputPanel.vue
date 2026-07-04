<script setup lang="ts">
import type { QuoteLanguage } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

defineProps<{
  language: QuoteLanguage;
  emailSubject: string;
  emailBody: string;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  'update:emailSubject': [value: string];
  'update:emailBody': [value: string];
  copyEmailSubject: [];
  copyEmailBody: [];
  openEmailClient: [];
}>();
</script>

<template>
  <section
    :class="
      embedded
        ? ''
        : 'bg-surface-card border border-surface-dark/5 rounded-3xl p-6 h-full'
    "
  >
    <div
      :class="
        embedded
          ? ''
          : 'rounded-3xl bg-white border border-surface-dark/5 p-5'
      "
    >
      <div v-if="!embedded" class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-heading font-bold text-surface-dark">Mail d’envoi</h3>
        <Button
          severity="secondary"
          size="small"
          class="!rounded-xl"
          label="Ouvrir dans Outlook"
          @click="emit('openEmailClient')"
        >
          <template #icon>
            <span class="material-symbols-outlined text-lg">outgoing_mail</span>
          </template>
        </Button>
      </div>
      <p class="mb-4 rounded-xl border border-surface-dark/8 bg-surface-light px-3 py-2 text-xs text-surface-dark/55">
        Variables disponibles :
        <code>{client}</code> prénom du client, <code>{titre}</code>, <code>{projet}</code>, <code>{ref}</code>,
        <code>{taux_horaire}</code>, <code>{taux_journalier}</code>
      </p>
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
