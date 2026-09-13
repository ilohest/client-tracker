<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Client, Project, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import ClientBentoTitle from '@/components/clients/ClientBentoTitle.vue';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { quoteStatusMeta } from '@/lib/clientPresets';
import { formatClientAddress } from '@/utils/address';
import { formatQuoteDate } from '@/utils/quote';
import {
  clientActivitySignals,
  clientActivityToneClass,
} from '@/utils/clientFilters';
import {
  isProjectOverdue,
  projectDoneMilestones,
  projectMacroStatus,
  projectMacroStatusMeta,
  projectProgress,
} from '@/utils/projectFilters';
import {
  projectActiveQuotes,
  projectTotalBudget,
} from '@/utils/projectFinance';

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
  viewQuotes: [];
  viewProjects: [];
  saveNotes: [notes: Client['clientNotes']];
}>();

const confirm = useConfirm();
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

const clientDisplayName = computed(() =>
  props.client?.name ||
  [props.client?.firstName, props.client?.lastName].filter(Boolean).join(' ') ||
  props.client?.companyName ||
  'Client à définir',
);

const formatRelativeDays = (value: unknown): string => {
  const date = value ? new Date(value as string) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 31) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'il y a 1 mois' : `il y a ${months} mois`;
};

const formatProjectDate = (value?: string): string => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
};

const displayedProjectBudget = (project: Project): number =>
  projectTotalBudget(project, projectActiveQuotes(project, props.quotes));

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
  <section class="h-full">
    <div v-if="client" class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Contact" icon="contact_mail" />
          <div class="mt-4">
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
        </section>

        <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Activité actuelle" icon="monitoring" />
          <div class="mt-4 flex flex-wrap gap-2">
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
        </section>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Facturation" icon="receipt" />
          <p class="mt-4 text-sm font-semibold text-surface-dark">{{ getCountryFlag(client.country) }} {{ getCountryLabel(client.country) }}</p>
          <p class="text-sm text-surface-dark/60 mt-1">
            {{ client.isVatRegistered ? client.vatNumber || 'Client assujetti à la TVA' : 'Client non assujetti à la TVA' }}
          </p>
        </section>
        <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Adresse de facturation" icon="location_on" />
          <p class="mt-4 text-sm text-surface-dark/70 whitespace-pre-line">{{ formatClientAddress(client) || 'Adresse non renseignée' }}</p>
        </section>
        <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Profil client" icon="badge" />
          <div class="mt-4 grid gap-2 text-sm">
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
        </section>
      </div>

      <section class="client-bento-card rounded-3xl p-5">
          <ClientBentoTitle title="Notes" icon="sticky_note_2" :count="clientNotes.length" />
          <div class="mb-4 mt-4 flex gap-2">
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
      </section>

      <section class="client-bento-card rounded-3xl p-5">
        <ClientBentoTitle
          title="Devis"
          icon="receipt_long"
          :count="quotes.length"
          clickable
          @click="emit('viewQuotes')"
        />

        <div v-if="!quotes.length" class="mt-4 rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55">
          Aucun devis lié à ce client pour l’instant.
        </div>

        <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-surface-dark/8">
          <table class="w-full min-w-[900px] border-collapse tabular-nums">
            <thead>
              <tr class="border-b border-surface-dark/10">
                <th class="client-list-heading">Client</th>
                <th class="client-list-heading">Projet</th>
                <th class="client-list-heading">Statut</th>
                <th class="client-list-heading client-list-heading-right">Montant TTC</th>
                <th class="client-list-heading">Date du devis</th>
                <th class="client-list-heading">Modifié</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="quote in quotes"
                :key="quote.id"
                class="cursor-pointer border-b border-surface-dark/6 transition last:border-b-0 hover:bg-surface-dark/3"
                tabindex="0"
                @click="emit('viewQuote', quote.id)"
                @keydown.enter="emit('viewQuote', quote.id)"
              >
                <td class="client-list-cell">
                  <div class="font-semibold text-surface-dark">{{ clientDisplayName }}</div>
                  <div class="mt-px font-mono text-[11.5px] text-surface-dark/55">{{ quote.quoteRef }}</div>
                </td>
                <td class="client-list-cell">
                  <div class="max-w-[240px] truncate text-[13.5px] text-surface-dark">
                    {{ quote.projectName || quote.title || 'Projet sans titre' }}
                  </div>
                  <div v-if="quote.customPlatformLabel?.trim()" class="mt-px max-w-[240px] truncate text-xs text-surface-dark/55">
                    {{ quote.customPlatformLabel.trim() }}
                  </div>
                </td>
                <td class="client-list-cell">
                  <Tag :value="quoteStatusLabel(quote.status)" :class="quoteStatusTagClass(quote.status)" rounded />
                </td>
                <td class="client-list-cell whitespace-nowrap text-right font-semibold text-surface-dark">
                  {{ formatMoney(quote.totalWithVat) }}
                </td>
                <td class="client-list-cell whitespace-nowrap text-surface-dark/70">
                  {{ quote.quoteDate ? formatQuoteDate(quote.quoteDate) : '—' }}
                </td>
                <td class="client-list-cell whitespace-nowrap text-surface-dark/70">
                  {{ formatRelativeDays(quote.updatedAt || quote.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="client-bento-card rounded-3xl p-5">
        <ClientBentoTitle
          title="Projets"
          icon="workspaces"
          :count="projects.length"
          clickable
          @click="emit('viewProjects')"
        />

        <div v-if="!projects.length" class="mt-4 rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55">
          Aucun projet lié à ce client pour l’instant.
        </div>

        <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-surface-dark/8">
          <table class="w-full min-w-[900px] border-collapse tabular-nums">
            <thead>
              <tr class="border-b border-surface-dark/10">
                <th class="client-list-heading">Projet</th>
                <th class="client-list-heading">Statut</th>
                <th class="client-list-heading">Avancement</th>
                <th class="client-list-heading client-list-heading-right">Budget HT</th>
                <th class="client-list-heading">Échéance</th>
                <th class="client-list-heading">Modifié</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="project in projects"
                :key="project.id"
                class="cursor-pointer border-b border-surface-dark/6 transition last:border-b-0 hover:bg-surface-dark/3"
                tabindex="0"
                @click="emit('viewProject', project.id)"
                @keydown.enter="emit('viewProject', project.id)"
              >
                <td class="client-list-cell">
                  <div class="flex items-center gap-2.5">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: project.color }"></span>
                    <div class="min-w-0">
                      <div class="max-w-[250px] truncate font-semibold text-surface-dark">{{ project.title }}</div>
                      <div class="mt-px truncate text-xs text-surface-dark/55">
                        {{ clientDisplayName }} · <span class="font-mono">{{ projectQuoteRefsLabel(project) }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="client-list-cell">
                  <Tag
                    :value="projectMacroStatusMeta[projectMacroStatus(project)].label"
                    :class="projectMacroStatusMeta[projectMacroStatus(project)].tagClass"
                    rounded
                  />
                </td>
                <td class="client-list-cell">
                  <div class="flex w-[130px] items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-dark/8">
                      <div class="h-full rounded-full bg-primary" :style="{ width: `${projectProgress(project)}%` }"></div>
                    </div>
                    <span class="w-14 shrink-0 text-right text-xs text-surface-dark/55">
                      {{ projectDoneMilestones(project) }}/{{ (project.milestones || []).length }}
                    </span>
                  </div>
                </td>
                <td class="client-list-cell whitespace-nowrap text-right font-semibold text-surface-dark">
                  {{ formatMoney(displayedProjectBudget(project)) }}
                </td>
                <td
                  class="client-list-cell whitespace-nowrap"
                  :class="isProjectOverdue(project) ? 'font-semibold text-rose-700' : 'text-surface-dark/70'"
                >
                  {{ formatProjectDate(project.dueDate) }}
                </td>
                <td class="client-list-cell whitespace-nowrap text-surface-dark/70">
                  {{ formatRelativeDays(project.updatedAt || project.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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

.client-list-heading {
  padding: 0.75rem 1rem;
  text-align: left;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(47, 43, 61, 0.38);
}

.client-list-heading-right {
  text-align: right;
}

.client-list-cell {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
}

</style>
