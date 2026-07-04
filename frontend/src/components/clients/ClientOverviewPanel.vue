<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Client, ClientProject, OnboardingTaskStatus, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { quoteStatusMeta } from '@/lib/clientPresets';
import { formatClientAddress, formatClientFullName } from '@/utils/address';
import { formatQuoteDate } from '@/utils/quote';

const props = defineProps<{
  client: Client | null;
  quotes: Quote[];
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  addProject: [];
  viewQuote: [quoteId: string];
  updateTaskStatus: [payload: { projectId: string; taskId: string; status: OnboardingTaskStatus }];
  uploadDocument: [file: File];
  removeDocument: [documentId: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedProjectId = ref<string>('');

const projectOptions = computed(() => {
  if (!props.client) return [];
  if (props.client.projects?.length) return props.client.projects;

  const legacyTasks = props.client.onboardingTasks || [];
  if (!legacyTasks.length) return [];

  return [
    {
      id: 'default-project',
      name: 'Projet principal',
      description: 'Checklist onboarding principale',
      onboardingTasks: legacyTasks,
    } satisfies ClientProject,
  ];
});

watch(
  () => [props.client?.id, projectOptions.value.map((project) => project.id).join('|')],
  () => {
    selectedProjectId.value = projectOptions.value[0]?.id || '';
  },
  { immediate: true },
);

const selectedProject = computed(() => {
  if (!projectOptions.value.length) return null;
  return (
    projectOptions.value.find((project) => project.id === selectedProjectId.value) ||
    projectOptions.value[0] ||
    null
  );
});

const progress = computed(() => {
  const tasks = selectedProject.value?.onboardingTasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter((task) => task.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
});

const taskStatusOptions: Array<{ label: string; value: OnboardingTaskStatus }> = [
  { label: 'À faire', value: 'todo' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Terminé', value: 'done' },
];

const openFilePicker = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  emit('uploadDocument', file);
  target.value = '';
};

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
};

const normalizeWebsiteUrl = (website: string): string => {
  if (!website) return '';
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
};

const normalizeMailto = (email: string): string => (email ? `mailto:${email}` : '');
const normalizeTel = (phone: string): string => (phone ? `tel:${phone.replace(/\s+/g, '')}` : '');

const languageLabel: Record<Client['language'], string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
};

const taskStatusLabel: Record<OnboardingTaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
};

const taskStatusTagClass: Record<OnboardingTaskStatus, string> = {
  todo: '!bg-surface-dark/8 !text-surface-dark',
  in_progress: '!bg-primary/12 !text-primary',
  done: '!bg-emerald-500/12 !text-emerald-700',
};

const taskCardClass: Record<OnboardingTaskStatus, string> = {
  todo: 'border-surface-dark/6 bg-surface-light',
  in_progress: 'border-primary/20 bg-primary/5',
  done: 'border-emerald-500/20 bg-emerald-500/5',
};

const quoteStatusLabel = (status: QuoteStatus): string => quoteStatusMeta[status].label;
const quoteStatusTagClass = (status: QuoteStatus): string => quoteStatusMeta[status].tagClass;

const shouldShowPlatformTag = computed(() => {
  const platform = props.client?.platform?.trim().toLowerCase();
  return Boolean(platform && platform !== 'other');
});
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-6 h-full">
    <div v-if="client" class="flex flex-col gap-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <h2 class="text-2xl font-heading font-bold text-surface-dark">{{ formatClientFullName(client) }}</h2>
            <Tag v-if="shouldShowPlatformTag" :value="client.platform" rounded class="!bg-primary/10 !text-primary" />
          </div>
          <p v-if="client.companyName" class="text-sm font-medium text-surface-dark/70 mb-1">{{ client.companyName }}</p>
          <a
            v-if="client.contactEmail"
            :href="normalizeMailto(client.contactEmail)"
            class="block text-sm text-surface-dark/60 hover:text-primary hover:underline"
          >
            {{ client.contactEmail }}
          </a>
          <p v-else class="text-sm text-surface-dark/60">Email non renseigné</p>
          <a
            v-if="client.phone"
            :href="normalizeTel(client.phone)"
            class="block text-sm text-surface-dark/60 hover:text-primary hover:underline"
          >
            {{ client.phone }}
          </a>
          <a
            v-if="client.website"
            :href="normalizeWebsiteUrl(client.website)"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <span class="material-symbols-outlined text-base">open_in_new</span>
            <span>{{ client.website }}</span>
          </a>
          <p v-else class="text-sm text-surface-dark/60">Site non renseigné</p>
        </div>

        <div class="flex gap-2">
          <Button text severity="secondary" @click="emit('edit')">
            <template #icon><span class="material-symbols-outlined text-lg">edit</span></template>
          </Button>
          <Button text severity="danger" @click="emit('delete')">
            <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Facturation</p>
          <p class="text-sm font-semibold text-surface-dark">{{ getCountryFlag(client.country) }} {{ getCountryLabel(client.country) }}</p>
          <p class="text-sm text-surface-dark/60 mt-1">
            {{ client.isVatRegistered ? client.vatNumber || 'Client assujetti à la TVA' : 'Client non assujetti à la TVA' }}
          </p>
        </div>
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Coordonnées</p>
          <p class="text-sm text-surface-dark/70 whitespace-pre-line">{{ formatClientAddress(client) || 'Adresse non renseignée' }}</p>
        </div>
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Profil client</p>
          <p class="text-sm text-surface-dark/70">Langue: {{ languageLabel[client.language] }}</p>
          <p class="text-sm text-surface-dark/70 mt-1">Prénom: {{ client.firstName || 'Non renseigné' }}</p>
          <p class="text-sm text-surface-dark/70 mt-1">Nom: {{ client.lastName || 'Non renseigné' }}</p>
          <p class="text-sm text-surface-dark/70 mt-1">Société: {{ client.companyName || 'Non renseignée' }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Progression projet</p>
          <p class="text-3xl font-heading font-bold text-surface-dark">{{ progress }}%</p>
          <p class="text-sm text-surface-dark/60 mt-1">
            {{ selectedProject ? `Checklist de ${selectedProject.name}` : 'Checklist centralisée pour réduire les relances.' }}
          </p>
        </div>
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Captation contenu</p>
          <p class="text-sm text-surface-dark/70">
            Utilise cette fiche comme script: objectifs, arborescence, textes finaux, visuels, accès, légal.
          </p>
        </div>
        <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Notes internes</p>
          <p class="text-sm text-surface-dark/70 whitespace-pre-line">{{ client.notes || 'Aucune note interne' }}</p>
        </div>
      </div>

      <div class="rounded-3xl bg-white border border-surface-dark/5 p-5">
        <div class="mb-4">
          <h3 class="text-lg font-heading font-bold text-surface-dark">Devis liés</h3>
          <p class="text-sm text-surface-dark/60">Retrouve ici les devis associés à ce client et leur statut.</p>
        </div>

        <div v-if="!quotes.length" class="rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55">
          Aucun devis lié à ce client pour l’instant.
        </div>

        <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <button
            v-for="quote in quotes"
            :key="quote.id"
            type="button"
            class="rounded-2xl border border-surface-dark/6 bg-surface-light p-4 text-left transition hover:border-primary/30 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="emit('viewQuote', quote.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="font-semibold text-surface-dark truncate">{{ quote.title || quote.quoteRef }}</p>
                <p class="text-sm text-surface-dark/55 mt-1">{{ quote.quoteRef }}</p>
              </div>
              <Tag :value="quoteStatusLabel(quote.status)" :class="quoteStatusTagClass(quote.status)" rounded />
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 text-sm text-surface-dark/65">
              <span>{{ quote.quoteDate ? formatQuoteDate(quote.quoteDate) : 'Date non renseignée' }}</span>
              <span class="font-semibold text-surface-dark">{{ quote.totalWithVat.toFixed(2) }} €</span>
            </div>
          </button>
        </div>
      </div>

      <div class="rounded-3xl bg-white border border-surface-dark/5 p-5">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 class="text-lg font-heading font-bold text-surface-dark">Documents client</h3>
            <p class="text-sm text-surface-dark/60">Ajoute ici des PDF externes liés à ce client.</p>
          </div>
          <div class="flex items-center gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="application/pdf"
              class="hidden"
              @change="handleFileChange"
            />
            <Button severity="secondary" @click="openFilePicker" label="Uploader un PDF">
              <template #icon><span class="material-symbols-outlined text-lg">upload_file</span></template></Button>
          </div>
        </div>

        <div v-if="!client.documents || client.documents.length === 0" class="rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55">
          Aucun PDF ajouté pour l’instant.
        </div>

        <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div
            v-for="document in client.documents"
            :key="document.id"
            class="rounded-2xl border border-surface-dark/6 bg-surface-light p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="font-semibold text-surface-dark truncate">{{ document.name }}</p>
                <p class="text-sm text-surface-dark/55 mt-1">
                  {{ formatFileSize(document.size) }} · {{ new Date(document.uploadedAt).toLocaleDateString('fr-FR') }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <a
                  :href="document.url"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center justify-center h-9 w-9 rounded-full text-surface-dark/60 hover:bg-white hover:text-primary transition-colors"
                >
                  <span class="material-symbols-outlined text-lg">open_in_new</span>
                </a>
                <Button text severity="danger" @click="emit('removeDocument', document.id)">
                  <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-3xl bg-white border border-surface-dark/5 p-5">
        <div class="flex flex-col gap-4 mb-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-heading font-bold text-surface-dark">Checklist onboarding</h3>
            </div>
            <Button severity="secondary" @click="emit('addProject')" label="Nouveau projet">
              <template #icon><span class="material-symbols-outlined text-lg">add</span></template></Button>
          </div>

          <div v-if="projectOptions.length" class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-3">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="project in projectOptions"
                :key="project.id"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition-colors"
                :class="project.id === selectedProjectId ? 'border-primary bg-primary/8 text-primary' : 'border-surface-dark/10 bg-surface-light text-surface-dark/70 hover:bg-white'"
                @click="selectedProjectId = project.id"
              >
                <p class="font-semibold">{{ project.name }}</p>
                <p v-if="project.description" class="text-sm mt-1 opacity-75">{{ project.description }}</p>
              </button>
            </div>

            <div class="rounded-2xl border border-surface-dark/8 bg-surface-light p-4">
              <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Projet actif</p>
              <Select
                v-model="selectedProjectId"
                :options="projectOptions"
                option-label="name"
                option-value="id"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <div v-if="selectedProject?.onboardingTasks.length" class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div
            v-for="task in selectedProject.onboardingTasks"
            :key="task.id"
            class="rounded-2xl border p-4 transition-colors"
            :class="taskCardClass[task.status]"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-semibold text-surface-dark">{{ task.title }}</p>
                <p class="text-sm text-surface-dark/60 mt-1">{{ task.description }}</p>
              </div>
              <div class="flex flex-col items-end gap-2">
                <Tag :value="task.category" class="!bg-surface-dark/8 !text-surface-dark" rounded />
                <Tag :value="taskStatusLabel[task.status]" :class="taskStatusTagClass[task.status]" rounded />
              </div>
            </div>

            <div class="mt-4">
              <Select
                :model-value="task.status"
                :options="taskStatusOptions"
                option-label="label"
                option-value="value"
                class="w-full"
                @update:model-value="emit('updateTaskStatus', { projectId: selectedProject.id, taskId: task.id, status: $event })"
              />
            </div>
          </div>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55"
        >
          Aucun projet ou aucune étape d’onboarding n’est encore configuré pour ce client.
        </div>
      </div>
    </div>

    <div
      v-else
      class="h-full rounded-3xl border border-dashed border-surface-dark/10 flex items-center justify-center text-surface-dark/55 text-sm"
    >
      Sélectionne un client pour voir son pipeline et sa checklist d’onboarding.
    </div>
  </section>
</template>
