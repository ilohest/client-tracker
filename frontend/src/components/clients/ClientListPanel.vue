<script setup lang="ts">
import type { Client } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { formatClientFullName } from '@/utils/address';
import { formatDateTime } from '@/utils/date';

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
  <section
    class="bg-surface-card border border-surface-dark/5 rounded-3xl p-4 h-full xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto"
  >
    <div class="sticky top-0 z-10 bg-surface-card pb-4">
      <Button
        class="mb-4 w-full !justify-center !rounded-xl !py-3 font-semibold shadow-sm"
        @click="emit('create')"
        label="Nouveau client"
      >
        <template #icon><span class="material-symbols-outlined text-lg">person_add</span></template>
      </Button>

      <InputText
        :model-value="search"
        placeholder="Rechercher un client"
        class="w-full"
        @update:model-value="emit('update:search', $event || '')"
      />
    </div>

    <div class="flex flex-col gap-2.5">
      <button
        v-for="client in clients"
        :key="client.id"
        class="w-full text-left rounded-2xl border p-3.5 transition-all duration-150"
        :class="
          selectedClientId === client.id
            ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
            : 'border-surface-dark/8 bg-white hover:border-primary/25 hover:shadow-sm'
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
        <p class="mt-2 text-[11px] leading-4 text-surface-dark/45">
          Modifié : {{ formatDateTime(client.updatedAt || client.createdAt) }}
        </p>
      </button>

      <div
        v-if="clients.length === 0"
        class="rounded-2xl border border-dashed p-6 text-center text-sm"
        :class="
          error
            ? 'border-red-200 bg-red-50/80 text-red-700'
            : 'border-surface-dark/12 text-surface-dark/50'
        "
      >
        {{ emptyMessage || 'Aucun client ne correspond.' }}
      </div>
    </div>
  </section>
</template>
