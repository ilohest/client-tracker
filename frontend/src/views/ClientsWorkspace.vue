<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Client, ClientInput } from '@client-tracker/contracts';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import ClientFormDialog from '@/components/clients/ClientFormDialog.vue';
import ClientListPanel from '@/components/clients/ClientListPanel.vue';
import ClientOverviewPanel from '@/components/clients/ClientOverviewPanel.vue';
import { getCountryLabel } from '@/lib/countries';
import { useClientsStore } from '@/stores/clientsStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { formatClientAddress, formatClientFullName } from '@/utils/address';

const clientsStore = useClientsStore();
const quotesStore = useQuotesStore();
const confirm = useConfirm();
const toast = useToast();
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
    client.language,
    client.isVatRegistered ? 'assujetti tva' : 'non assujetti tva',
    ...client.onboardingTasks.flatMap((task) => [task.title, task.description, task.category, task.status]),
    ...(client.projects || []).flatMap((project) => [
      project.name,
      project.description,
      ...project.onboardingTasks.flatMap((task) => [task.title, task.description, task.category, task.status]),
    ]),
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

onMounted(() => {
  clientsStore.fetchClients();
  quotesStore.fetchQuotes();
});

const openCreateDialog = () => {
  dialogClient.value = null;
  dialogVisible.value = true;
};

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
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div>
      <div class="flex items-center gap-3">
        <span
          class="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-2xl text-primary"
          >groups</span
        >
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Clients</h1>
      </div>
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
        @edit="openEditDialog"
        @delete="handleDelete"
        @add-project="selectedClient && clientsStore.addProject(selectedClient.id)"
        @update-task-status="selectedClient && clientsStore.updateTaskStatus(selectedClient.id, $event.projectId, $event.taskId, $event.status)"
        @upload-document="handleUploadDocument"
        @remove-document="handleRemoveDocument"
        @view-quote="openRelatedQuote"
      />
    </div>

    <ClientFormDialog
      v-model:visible="dialogVisible"
      :client="dialogClient"
      @save="handleSave"
    />
  </div>
</template>
