<script setup lang="ts">
import type { Client } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { formatClientFullName } from '@/utils/address';

defineProps<{
  clients: Client[];
  selectedClientId: string | null;
  search: string;
  error?: string | null;
  emptyMessage?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  'update:search': [value: string];
}>();
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-5 h-full">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-heading font-bold text-surface-dark">Clients</h2>
        <p class="text-sm text-surface-dark/60">Vue globale des projets et onboarding.</p>
      </div>
      <Button rounded @click="emit('create')">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <div class="mb-4">
      <span class="text-sm font-semibold text-surface-dark block mb-2">Recherche</span>
      <InputText
        :model-value="search"
        placeholder="Nom, société, email, site, pays, TVA, adresse, notes..."
        class="w-full"
        @update:model-value="emit('update:search', $event || '')"
      />
    </div>

    <div class="flex flex-col gap-3">
      <button
        v-for="client in clients"
        :key="client.id"
        class="w-full text-left rounded-2xl border p-4 transition-all"
        :class="
          selectedClientId === client.id
            ? 'bg-primary/10 border-primary/20'
            : 'bg-white border-surface-dark/8 hover:border-primary/15 hover:bg-white/80'
        "
        @click="emit('select', client.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-bold font-heading text-surface-dark truncate">{{ formatClientFullName(client) }}</p>
            <p class="text-sm text-surface-dark/55 truncate">{{ client.website || 'Site non renseigné' }}</p>
          </div>
          <Tag :value="`${getCountryFlag(client.country)} ${getCountryLabel(client.country)}`" class="!bg-surface-dark/8 !text-surface-dark" rounded />
        </div>
        <div class="flex items-center justify-between mt-4 text-xs text-surface-dark/60">
          <span>{{ client.language.toUpperCase() }}</span>
          <span>{{ client.isVatRegistered ? client.vatNumber || 'TVA active' : 'Non assujetti TVA' }}</span>
        </div>
      </button>

      <div
        v-if="clients.length === 0"
        class="rounded-2xl border border-dashed p-5 text-sm"
        :class="
          error
            ? 'border-red-200 bg-red-50/80 text-red-700'
            : 'border-surface-dark/10 text-surface-dark/55'
        "
      >
        {{ emptyMessage || 'Aucun client ne correspond à la recherche. Essaie avec un autre mot-clé.' }}
      </div>
    </div>
  </section>
</template>
