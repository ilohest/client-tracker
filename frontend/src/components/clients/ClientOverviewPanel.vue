<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Client, Project, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { quoteStatusMeta } from '@/lib/clientPresets';
import { formatClientAddress } from '@/utils/address';
import { formatQuoteDate } from '@/utils/quote';
import {
  clientActivitySignals,
  clientActivityToneClass,
} from '@/utils/clientFilters';

const props = defineProps<{
  client: Client | null;
  quotes: Quote[];
  projects: Project[];
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  viewQuote: [quoteId: string];
  viewProject: [projectId: string];
  saveNotes: [notes: Client['clientNotes']];
  uploadDocument: [file: File];
  removeDocument: [documentId: string];
}>();

const confirm = useConfirm();
const fileInput = ref<HTMLInputElement | null>(null);
const newClientNote = ref('');
const clientNoteDrafts = reactive<Record<string, string>>({});

const clientNotes = computed(() => props.client?.clientNotes || []);
const activitySignals = computed(() =>
  props.client
    ? clientActivitySignals(props.client, props.quotes, props.projects)
    : [],
);

watch(
  () => [props.client?.id, props.client?.clientNotes] as const,
  () => {
    const currentIds = new Set(clientNotes.value.map((note) => note.id));
    for (const note of clientNotes.value) {
      if (clientNoteDrafts[note.id] === undefined) clientNoteDrafts[note.id] = note.content;
    }
    for (const id of Object.keys(clientNoteDrafts)) {
      if (!currentIds.has(id)) delete clientNoteDrafts[id];
    }
    newClientNote.value = '';
  },
  { immediate: true },
);

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

const quoteStatusLabel = (status: QuoteStatus): string => quoteStatusMeta[status].label;

const projectQuoteRefsLabel = (project: Project): string => {
  const refs = props.quotes
    .filter((quote) => quote.projectId === project.id)
    .map((quote) => quote.quoteRef)
    .filter(Boolean);
  if (refs.length) return refs.join(' + ');
  return project.sourceType === 'custom' ? 'Hors devis' : 'Devis lié';
};
const quoteStatusTagClass = (status: QuoteStatus): string => quoteStatusMeta[status].tagClass;

const projectStatusLabel: Record<Project['status'], string> = {
  proposal_accepted: 'Devis accepté',
  deposit_pending: 'Acompte à envoyer',
  deposit_paid: 'Acompte reçu',
  in_progress: 'En cours',
  blocked: 'Bloqué',
  client_review: 'Validation client',
  ready_to_invoice: 'À facturer',
  invoiced: 'Facturé',
  paid: 'Payé',
  closed: 'Clôturé',
};

const projectStatusClass = (project: Project) => {
  if (project.status === 'blocked' || project.health === 'blocked') return '!bg-red-500/12 !text-red-700';
  if (['paid', 'closed'].includes(project.status)) return '!bg-emerald-500/12 !text-emerald-700';
  if (['ready_to_invoice', 'deposit_pending'].includes(project.status)) return '!bg-amber-500/12 !text-amber-700';
  return '!bg-primary/10 !text-primary';
};

const projectNextAction = (project: Project): string =>
  project.milestones?.find((milestone) => milestone.status !== 'done')?.label ||
  'Toutes les étapes sont terminées';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

const addClientNote = () => {
  if (!newClientNote.value.trim()) return;
  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID(),
    content: newClientNote.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
  clientNoteDrafts[note.id] = note.content;
  newClientNote.value = '';
  emit('saveNotes', [note, ...clientNotes.value]);
};

const hasClientNoteChanges = (note: Client['clientNotes'][number]) =>
  (clientNoteDrafts[note.id] ?? note.content) !== note.content;

const updateClientNoteDraft = (noteId: string, value: string | undefined) => {
  clientNoteDrafts[noteId] = value || '';
};

const saveClientNote = (note: Client['clientNotes'][number]) => {
  if (!hasClientNoteChanges(note)) return;
  const content = clientNoteDrafts[note.id] ?? '';
  emit(
    'saveNotes',
    clientNotes.value.map((item) =>
      item.id === note.id ? { ...item, content, updatedAt: new Date().toISOString() } : item,
    ),
  );
};

const confirmDeleteClientNote = (noteId: string) => {
  confirm.require({
    message: 'Voulez-vous vraiment supprimer cette note ?',
    header: 'Supprimer la note',
    icon: 'info',
    rejectProps: { label: 'Annuler', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    accept: () => {
      delete clientNoteDrafts[noteId];
      emit('saveNotes', clientNotes.value.filter((note) => note.id !== noteId));
    },
  });
};
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-6 h-full">
    <div v-if="client" class="flex flex-col gap-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Contact</p>
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
      </div>

      <div class="client-bento-card rounded-2xl p-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-surface-dark/45">Activité actuelle</p>
            <p class="mt-1 text-sm text-surface-dark/60">
              Calculée automatiquement depuis les devis, projets et paiements.
            </p>
          </div>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <span
              v-for="signal in activitySignals"
              :key="signal.key"
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              :class="clientActivityToneClass[signal.tone]"
            >
              <span class="material-symbols-outlined text-sm">{{ signal.icon }}</span>
              {{ signal.label }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="client-bento-card rounded-2xl p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Facturation</p>
          <p class="text-sm font-semibold text-surface-dark">{{ getCountryFlag(client.country) }} {{ getCountryLabel(client.country) }}</p>
          <p class="text-sm text-surface-dark/60 mt-1">
            {{ client.isVatRegistered ? client.vatNumber || 'Client assujetti à la TVA' : 'Client non assujetti à la TVA' }}
          </p>
        </div>
        <div class="client-bento-card rounded-2xl p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Adresse de facturation</p>
          <p class="text-sm text-surface-dark/70 whitespace-pre-line">{{ formatClientAddress(client) || 'Adresse non renseignée' }}</p>
        </div>
        <div class="client-bento-card rounded-2xl p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Profil client</p>
          <div class="mt-3 grid gap-2 text-sm">
            <div class="flex items-center justify-between gap-4">
              <span class="font-medium text-surface-dark/45">Langue</span>
              <span class="text-right font-semibold text-surface-dark">{{ languageLabel[client.language] }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="font-medium text-surface-dark/45">Prénom</span>
              <span class="text-right font-semibold text-surface-dark">{{ client.firstName || 'Non renseigné' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="font-medium text-surface-dark/45">Nom</span>
              <span class="text-right font-semibold text-surface-dark">{{ client.lastName || 'Non renseigné' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="font-medium text-surface-dark/45">Société</span>
              <span class="text-right font-semibold text-surface-dark">{{ client.companyName || 'Non renseignée' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div class="client-bento-card rounded-2xl p-4">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="flex items-center gap-2 font-heading text-lg font-bold text-surface-dark">
              <span class="material-symbols-outlined text-primary">sticky_note_2</span>
              Notes
            </h3>
            <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{{ clientNotes.length }}</span>
          </div>
          <div class="mb-4 flex gap-2">
            <InputText
              v-model="newClientNote"
              placeholder="Ajouter une note client..."
              class="flex-1 !text-sm !rounded-xl"
              @keydown.enter="addClientNote"
            />
            <Button
              aria-label="Ajouter"
              :disabled="!newClientNote.trim()"
              class="!h-10 !w-10 !rounded-xl"
              @click="addClientNote"
            >
              <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
            </Button>
          </div>
          <div class="space-y-3">
            <div
              v-for="note in clientNotes"
              :key="note.id"
              class="group flex items-start gap-2 rounded-xl border border-surface-dark/8 bg-white p-3 text-sm text-surface-dark/70 transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <Textarea
                :model-value="clientNoteDrafts[note.id] ?? note.content"
                auto-resize
                rows="2"
                class="flex-1 !border-0 !bg-transparent !p-0 !text-sm !leading-relaxed !shadow-none focus:!ring-0"
                @update:model-value="updateClientNoteDraft(note.id, $event)"
              />
              <div class="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Enregistrer"
                  title="Enregistrer"
                  :disabled="!hasClientNoteChanges(note)"
                  class="flex h-7 w-7 items-center justify-center rounded-full text-surface-dark/35 transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-25"
                  @click="saveClientNote(note)"
                >
                  <span class="material-symbols-outlined text-xs">save</span>
                </button>
                <button
                  type="button"
                  aria-label="Supprimer"
                  title="Supprimer"
                  class="flex h-7 w-7 items-center justify-center rounded-full text-surface-dark/35 transition-colors hover:bg-red-50 hover:text-red-500"
                  @click="confirmDeleteClientNote(note.id)"
                >
                  <span class="material-symbols-outlined text-xs">delete</span>
                </button>
              </div>
            </div>
            <div v-if="clientNotes.length === 0" class="py-8 text-center text-xs italic text-surface-dark/40">
              Aucune note pour l'instant.
            </div>
          </div>
        </div>
        <div class="client-bento-card rounded-2xl p-4">
          <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-2">Résumé projets</p>
          <p class="text-3xl font-heading font-bold text-surface-dark">{{ projects.length }}</p>
          <p class="text-sm text-surface-dark/60 mt-1">
            {{ projects.length > 1 ? 'projets liés à ce client' : projects.length === 1 ? 'projet lié à ce client' : 'Aucun projet lié pour l’instant' }}
          </p>
          <p class="mt-3 text-sm font-semibold text-primary">
            {{ formatMoney(projects.reduce((total, project) => total + Number(project.budgetExVat || 0), 0)) }} HT prévus
          </p>
        </div>
      </div>

      <div class="client-bento-card rounded-3xl p-5">
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
            class="client-bento-item rounded-2xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

      <div class="client-bento-card rounded-3xl p-5">
        <div class="mb-4">
          <h3 class="text-lg font-heading font-bold text-surface-dark">Projets du client</h3>
          <p class="text-sm text-surface-dark/60">Tous les projets et prestations reliés à cette fiche client.</p>
        </div>

        <div v-if="!projects.length" class="rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55">
          Aucun projet lié à ce client pour l’instant.
        </div>

        <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            class="client-bento-item rounded-2xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="emit('viewProject', project.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="truncate font-semibold text-surface-dark">{{ project.title }}</p>
                <p class="mt-1 text-sm text-surface-dark/55">
                  {{ projectQuoteRefsLabel(project) }}
                </p>
              </div>
              <Tag :value="projectStatusLabel[project.status]" :class="projectStatusClass(project)" rounded />
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 text-sm text-surface-dark/65">
              <span>{{ projectNextAction(project) }}</span>
              <span class="font-semibold text-surface-dark">{{ formatMoney(project.budgetExVat) }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="client-bento-card rounded-3xl p-5">
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
            class="client-bento-item rounded-2xl p-4"
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
                <Button text rounded severity="danger" aria-label="Supprimer" title="Supprimer" @click="emit('removeDocument', document.id)">
                  <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div
      v-else
      class="h-full rounded-3xl border border-dashed border-surface-dark/10 flex items-center justify-center text-surface-dark/55 text-sm"
    >
      Sélectionne un client pour voir ses devis, projets et notes internes.
    </div>
  </section>
</template>

<style scoped>
.client-bento-card {
  background: #ffffff;
  border: 1px solid rgba(47, 43, 61, 0.11);
  box-shadow: 0 10px 28px rgba(47, 43, 61, 0.055), 0 1px 0 rgba(47, 43, 61, 0.05);
}

.client-bento-item {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(47, 43, 61, 0.12);
  box-shadow: 0 6px 18px rgba(47, 43, 61, 0.045);
}

.client-bento-item:hover {
  background: #ffffff;
  border-color: rgba(233, 106, 95, 0.34);
  box-shadow: 0 12px 28px rgba(47, 43, 61, 0.08);
}
</style>
