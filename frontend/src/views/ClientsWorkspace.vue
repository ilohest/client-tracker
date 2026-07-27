<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Client, ClientInput } from '@client-tracker/contracts';
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRoute, useRouter } from 'vue-router';
import ClientFormDialog from '@/components/clients/ClientFormDialog.vue';
import ClientListPanel from '@/components/clients/ClientListPanel.vue';
import ClientOverviewPanel from '@/components/clients/ClientOverviewPanel.vue';
import { getCountryLabel } from '@/lib/countries';
import { useClientsStore } from '@/stores/clientsStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { formatClientAddress, formatClientFullName } from '@/utils/address';

const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const confirm = useConfirm();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const dialogVisible = ref(false);
const dialogClient = ref<Client | null>(null);
const search = ref('');

const searchableClientText = (client: Client) =>
  [
    formatClientFullName(client),
    client.firstName,
    client.lastName,
    client.companyName,
    client.contactEmail,
    client.phone,
    formatClientAddress(client),
    client.website,
    client.country,
    getCountryLabel(client.country),
    client.vatNumber,
    client.notes,
    ...(client.clientNotes || []).map((note) => note.content),
    client.language,
    client.isVatRegistered ? 'assujetti tva' : 'non assujetti tva',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const clients = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return clientsStore.clients;
  return clientsStore.clients.filter((client) => searchableClientText(client).includes(query));
});

const clientListMessage = computed(() => {
  if (clientsStore.error) return clientsStore.error;
  if (search.value.trim()) return 'Aucun client ne correspond à la recherche. Essaie avec un autre mot-clé.';
  return 'Aucun client visible pour le moment.';
});

const selectedClient = computed(() => {
  const current = clientsStore.selectedClient;
  if (current && clients.value.some((client) => client.id === current.id)) return current;
  return clients.value[0] || null;
});

const relatedQuotes = computed(() => {
  if (!selectedClient.value) return [];
  return quotesStore.quotes.filter((quote) => quote.clientId === selectedClient.value?.id);
});

const relatedProjects = computed(() => {
  if (!selectedClient.value) return [];
  return projectsStore.projects.filter((project) => project.clientId === selectedClient.value?.id);
});

onMounted(() => {
  clientsStore.fetchClients();
  quotesStore.fetchQuotes();
  projectsStore.fetchProjects();
});

const openCreateDialog = () => {
  dialogClient.value = null;
  dialogVisible.value = true;
};

watch(
  () => route.query.new,
  (value) => {
    if (value !== '1') return;
    openCreateDialog();
    const query = { ...route.query };
    delete query.new;
    void router.replace({ query });
  },
  { immediate: true },
);

const openEditDialog = () => {
  dialogClient.value = selectedClient.value;
  dialogVisible.value = true;
};

const handleSave = async (payload: ClientInput, id: string | null) => {
  await clientsStore.saveClient(id, payload);
  dialogClient.value = null;
  dialogVisible.value = false;
  toast.add({ severity: 'success', summary: 'Client enregistré', detail: 'La fiche client a été mise à jour.', life: 2500 });
};

const handleDelete = () => {
  if (!selectedClient.value) return;
  const client = selectedClient.value;
  const clientLabel = formatClientFullName(client) || client.companyName || 'ce client';

  confirm.require({
    message: `Supprimer définitivement ${clientLabel} ?`,
    header: 'Supprimer le client ?',
    icon: 'warning',
    rejectProps: {
      label: 'Annuler',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Supprimer',
      severity: 'danger',
    },
    accept: async () => {
      await clientsStore.deleteClient(client.id);
      toast.add({ severity: 'secondary', summary: 'Client supprimé', detail: 'La fiche a été retirée.', life: 2500 });
    },
  });
};

const handleUploadDocument = async (file: File) => {
  if (!selectedClient.value) return;
  if (file.type !== 'application/pdf') {
    toast.add({ severity: 'error', summary: 'Format non supporté', detail: 'Seuls les PDF sont autorisés.', life: 2500 });
    return;
  }

  await clientsStore.uploadClientDocument(selectedClient.value.id, file);
  toast.add({ severity: 'success', summary: 'PDF ajouté', detail: 'Le document a été associé au client.', life: 2500 });
};

const handleRemoveDocument = async (documentId: string) => {
  if (!selectedClient.value) return;
  await clientsStore.removeClientDocument(selectedClient.value.id, documentId);
  toast.add({ severity: 'secondary', summary: 'Document supprimé', detail: 'Le PDF a été retiré du profil client.', life: 2200 });
};

const openRelatedQuote = (quoteId: string) => {
  quotesStore.selectQuote(quoteId);
  router.push({ name: 'quotes' });
};

const openRelatedProject = (projectId: string) => {
  projectsStore.selectProject(projectId);
  router.push({ name: 'projects' });
};

const handleSaveNotes = async (notes: Client['clientNotes']) => {
  if (!selectedClient.value) return;
  await clientsStore.updateClientNotesList(selectedClient.value.id, notes);
  toast.add({ severity: 'success', summary: 'Notes enregistrées', detail: 'Les notes internes du client ont été mises à jour.', life: 2200 });
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">groups</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Clients</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            {{ clients.length }} client{{ clients.length > 1 ? "s" : "" }} · Suivi des fiches et de la relation client.
          </p>
        </div>
      </div>
      <Button label="Nouveau client" @click="openCreateDialog">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 min-h-[70vh]">
      <ClientListPanel
        :clients="clients"
        :selected-client-id="selectedClient?.id || null"
        :search="search"
        :error="clientsStore.error"
        :empty-message="clientListMessage"
        @create="openCreateDialog"
        @select="clientsStore.selectClient"
        @update:search="search = $event"
      />

      <ClientOverviewPanel
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
    </div>

    <ClientFormDialog
      v-model:visible="dialogVisible"
      :client="dialogClient"
      @save="handleSave"
    />
  </div>
</template>
