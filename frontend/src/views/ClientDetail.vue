<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Client, ClientInput, ClientStage } from '@client-tracker/contracts';
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRoute, useRouter } from 'vue-router';
import ClientFormDialog from '@/components/clients/ClientFormDialog.vue';
import ClientOverviewPanel from '@/components/clients/ClientOverviewPanel.vue';
import { clientStageOptions } from '@/lib/clientPresets';
import { useClientsStore } from '@/stores/clientsStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { formatClientFullName } from '@/utils/address';
import { getQuotePlatformLabel } from '@/utils/quote';
import {
  buildClientList,
  clientActiveProjects,
  clientDisplayName,
  clientQuotes,
  clientSignedRevenue,
  clientStageLabel,
  clientStageTagClass,
  readClientListQuery,
} from '@/utils/clientFilters';

const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const confirm = useConfirm();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const dialogVisible = ref(false);

const selectedClient = computed(() => clientsStore.selectedClient);

const relatedQuotes = computed(() =>
  selectedClient.value
    ? quotesStore.quotes.filter((quote) => quote.clientId === selectedClient.value?.id)
    : [],
);

const relatedProjects = computed(() =>
  selectedClient.value
    ? projectsStore.projects.filter((project) => project.clientId === selectedClient.value?.id)
    : [],
);

// --- NAVIGATION INDEX <-> DÉTAIL ---
// L'index transmet son état de liste dans l'URL : le pas-à-pas suit le même ordre
// filtré que le tableau qu'on vient de quitter.
const listQuery = computed(() => ({ ...route.query }));

const siblingClients = computed(() =>
  buildClientList(clientsStore.clients, readClientListQuery(listQuery.value), {
    quoteCountOf: (client) => clientQuotes(client, quotesStore.quotes).length,
    revenueOf: (client) => clientSignedRevenue(client, quotesStore.quotes),
    projectCountOf: (client) => clientActiveProjects(client, projectsStore.projects).length,
  }),
);
const siblingIndex = computed(() =>
  siblingClients.value.findIndex((client) => client.id === clientsStore.selectedClientId),
);
const previousClient = computed(() =>
  siblingIndex.value > 0 ? siblingClients.value[siblingIndex.value - 1] : null,
);
const nextClient = computed(() =>
  siblingIndex.value >= 0 && siblingIndex.value < siblingClients.value.length - 1
    ? siblingClients.value[siblingIndex.value + 1]
    : null,
);

const routeClientId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
);

const backToList = () => {
  void router.push({ name: 'clients', query: listQuery.value });
};

const goToSibling = (client: Client | null) => {
  if (!client) return;
  void router.push({ name: 'client-detail', params: { id: client.id }, query: route.query });
};

/** La route est la source de vérité pour la sélection. */
const loadFromRoute = () => {
  const client = clientsStore.clients.find((entry) => entry.id === routeClientId.value) || null;
  // Lien périmé ou fiche supprimée : on renvoie à la liste plutôt que d'afficher
  // un écran vide.
  if (!client) {
    void router.replace({ name: 'clients', query: listQuery.value });
    toast.add({
      severity: 'warn',
      summary: 'Client introuvable',
      detail: 'Cette fiche n’existe plus ou n’est pas accessible.',
      life: 3000,
    });
    return;
  }
  clientsStore.selectClient(client.id);
};

watch(routeClientId, () => {
  if (!clientsStore.clients.length) return;
  if (clientsStore.selectedClientId === routeClientId.value) return;
  loadFromRoute();
});

onMounted(async () => {
  await Promise.all([
    clientsStore.clients.length ? Promise.resolve() : clientsStore.fetchClients(),
    quotesStore.quotes.length ? Promise.resolve() : quotesStore.fetchQuotes(),
    projectsStore.projects.length ? Promise.resolve() : projectsStore.fetchProjects(),
  ]);
  loadFromRoute();
});

const showPlatformTag = computed(() => {
  const platform = selectedClient.value?.platform?.trim().toLowerCase();
  return Boolean(platform && platform !== 'other');
});

const openEditDialog = () => {
  dialogVisible.value = true;
};

const handleSave = async (payload: ClientInput, id: string | null) => {
  await clientsStore.saveClient(id, payload);
  dialogVisible.value = false;
  toast.add({
    severity: 'success',
    summary: 'Client enregistré',
    detail: 'La fiche client a été mise à jour.',
    life: 2500,
  });
};

/** La relation est choisie manuellement ; l'activité est calculée depuis devis et projets. */
const updateStage = async (stage: ClientStage) => {
  const client = selectedClient.value;
  if (!client || client.stage === stage) return;
  await clientsStore.saveClient(client.id, { ...client, stage } as ClientInput);
  toast.add({
    severity: 'success',
    summary: 'Relation mise à jour',
    detail: `${clientDisplayName(client)} est maintenant en « ${clientStageLabel(stage)} ».`,
    life: 2200,
  });
};

const handleDelete = () => {
  const client = selectedClient.value;
  if (!client) return;
  const clientLabel = formatClientFullName(client) || client.companyName || 'ce client';

  confirm.require({
    message: `Supprimer définitivement ${clientLabel} ?`,
    header: 'Supprimer le client ?',
    icon: 'warning',
    rejectProps: { label: 'Annuler', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    accept: async () => {
      await clientsStore.deleteClient(client.id);
      await router.push({ name: 'clients', query: listQuery.value });
      toast.add({
        severity: 'secondary',
        summary: 'Client supprimé',
        detail: 'La fiche a été retirée.',
        life: 2500,
      });
    },
  });
};

const handleUploadDocument = async (file: File) => {
  if (!selectedClient.value) return;
  if (file.type !== 'application/pdf') {
    toast.add({
      severity: 'error',
      summary: 'Format non supporté',
      detail: 'Seuls les PDF sont autorisés.',
      life: 2500,
    });
    return;
  }

  await clientsStore.uploadClientDocument(selectedClient.value.id, file);
  toast.add({
    severity: 'success',
    summary: 'PDF ajouté',
    detail: 'Le document a été associé au client.',
    life: 2500,
  });
};

const handleRemoveDocument = async (documentId: string) => {
  if (!selectedClient.value) return;
  await clientsStore.removeClientDocument(selectedClient.value.id, documentId);
  toast.add({
    severity: 'secondary',
    summary: 'Document supprimé',
    detail: 'Le PDF a été retiré du profil client.',
    life: 2200,
  });
};

const openRelatedQuote = (quoteId: string) => {
  quotesStore.selectQuote(quoteId);
  router.push({ name: 'quote-detail', params: { id: quoteId } });
};

const openRelatedProject = (projectId: string) => {
  projectsStore.selectProject(projectId);
  router.push({ name: 'project-detail', params: { id: projectId } });
};

const handleSaveNotes = async (notes: Client['clientNotes']) => {
  if (!selectedClient.value) return;
  await clientsStore.updateClientNotesList(selectedClient.value.id, notes);
  toast.add({
    severity: 'success',
    summary: 'Notes enregistrées',
    detail: 'Les notes internes du client ont été mises à jour.',
    life: 2200,
  });
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div
      v-if="selectedClient"
      class="sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-3xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
    >
      <div class="flex min-w-0 flex-1 basis-[320px] items-center gap-3">
        <Button
          text
          severity="secondary"
          class="!h-9 !w-9 !shrink-0 !rounded-xl !p-0"
          aria-label="Retour à la liste des clients"
          title="Retour à la liste des clients"
          @click="backToList"
        >
          <template #icon><span class="material-symbols-outlined text-lg">arrow_back</span></template>
        </Button>

        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate font-heading text-lg font-bold text-surface-dark">
              {{ clientDisplayName(selectedClient) }}
            </h1>
            <Tag
              v-if="showPlatformTag"
              :value="getQuotePlatformLabel(selectedClient.platform)"
              rounded
              class="!bg-primary/10 !text-primary"
            />
          </div>
          <p class="truncate text-xs text-surface-dark/55">
            <template v-if="selectedClient.companyName">
              {{ selectedClient.companyName }} ·
            </template>
            {{ relatedQuotes.length }} devis · {{ relatedProjects.length }} projet{{
              relatedProjects.length > 1 ? "s" : ""
            }}
          </p>
        </div>

        <div
          v-if="siblingIndex >= 0 && siblingClients.length > 1"
          class="ml-1 flex shrink-0 items-center gap-0.5 border-l border-surface-dark/8 pl-2"
        >
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Client précédent"
            :disabled="!previousClient"
            @click="goToSibling(previousClient)"
          >
            <template #icon><span class="material-symbols-outlined text-lg">chevron_left</span></template>
          </Button>
          <span class="whitespace-nowrap px-1 text-[11px] tabular-nums text-surface-dark/40">
            {{ siblingIndex + 1 }} / {{ siblingClients.length }}
          </span>
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Client suivant"
            :disabled="!nextClient"
            @click="goToSibling(nextClient)"
          >
            <template #icon><span class="material-symbols-outlined text-lg">chevron_right</span></template>
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <label class="grid gap-1">
          <span class="pl-1 text-[10px] font-bold uppercase tracking-wider text-surface-dark/35">Relation</span>
          <Select
            :model-value="selectedClient.stage"
            :options="clientStageOptions"
            option-label="label"
            option-value="value"
            class="w-52"
            @update:model-value="updateStage($event)"
          >
            <template #value="{ value }">
              <Tag
                v-if="value"
                :value="clientStageLabel(value as ClientStage)"
                :class="clientStageTagClass[value as ClientStage]"
                rounded
              />
            </template>
            <template #option="{ option }">
              <Tag
                :value="option.label"
                :class="clientStageTagClass[option.value as ClientStage]"
                rounded
              />
            </template>
          </Select>
        </label>
        <Button
          severity="secondary"
          outlined
          class="!rounded-xl"
          label="Modifier"
          @click="openEditDialog"
        >
          <template #icon><span class="material-symbols-outlined text-lg">edit</span></template>
        </Button>
        <Button
          text
          severity="danger"
          class="!h-9 !w-9 !rounded-xl !p-0"
          aria-label="Supprimer le client"
          title="Supprimer le client"
          @click="handleDelete"
        >
          <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
        </Button>
      </div>
    </div>

    <ClientOverviewPanel
      v-if="selectedClient"
      :client="selectedClient"
      :quotes="relatedQuotes"
      :projects="relatedProjects"
      @edit="openEditDialog"
      @delete="handleDelete"
      @upload-document="handleUploadDocument"
      @remove-document="handleRemoveDocument"
      @view-quote="openRelatedQuote"
      @view-project="openRelatedProject"
      @save-notes="handleSaveNotes"
    />

    <ClientFormDialog
      v-model:visible="dialogVisible"
      :client="selectedClient"
      @save="handleSave"
    />
  </div>
</template>
