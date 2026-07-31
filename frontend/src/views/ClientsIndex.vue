<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Client, ClientInput, ClientPlatform, ClientStage } from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import InputText from "primevue/inputtext";
import Menu from "primevue/menu";
import Select from "primevue/select";
import Tag from "primevue/tag";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ClientFormDialog from "@/components/clients/ClientFormDialog.vue";
import { clientStageOptions, platformOptions } from "@/lib/clientPresets";
import { getCountryFlag } from "@/lib/countries";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { formatCurrency, getQuotePlatformLabel } from "@/utils/quote";
import { toDateObj } from "@/utils/date";
import type { ClientSortField } from "@/utils/clientFilters";
import {
  buildClientList,
  clientActivitySignals,
  clientActivityToneClass,
  clientActiveProjects,
  clientDisplayName,
  clientQuotes,
  clientSignedRevenue,
  clientStageLabel,
  clientStageTagClass,
  readClientListQuery,
  writeClientListQuery,
} from "@/utils/clientFilters";

const route = useRoute();
const router = useRouter();
const clientsStore = useClientsStore();
const quotesStore = useQuotesStore();
const projectsStore = useProjectsStore();
const confirm = useConfirm();
const toast = useToast();

const initialState = readClientListQuery(route.query);
const search = ref(initialState.search);
const filterStage = ref<ClientStage | "">(initialState.stage);
const filterPlatform = ref<ClientPlatform | "">(initialState.platform);
const sortField = ref<ClientSortField>(initialState.sortField);
const sortDirection = ref(initialState.sortDirection);

const dialogVisible = ref(false);
const rowMenu = ref<InstanceType<typeof Menu> | null>(null);
const menuClientId = ref("");

const listState = computed(() => ({
  search: search.value,
  stage: filterStage.value,
  platform: filterPlatform.value,
  sortField: sortField.value,
  sortDirection: sortDirection.value,
}));

const listQuery = computed(() => writeClientListQuery(listState.value));

watch(listQuery, (query) => {
  if (JSON.stringify(query) === JSON.stringify(route.query)) return;
  void router.replace({ name: "clients", query });
});

onMounted(async () => {
  await Promise.all([
    clientsStore.fetchClients(),
    quotesStore.fetchQuotes(),
    projectsStore.fetchProjects(),
  ]);
});

const quoteCountOf = (client: Client) => clientQuotes(client, quotesStore.quotes).length;
const revenueOf = (client: Client) => clientSignedRevenue(client, quotesStore.quotes);
const projectCountOf = (client: Client) =>
  clientActiveProjects(client, projectsStore.projects).length;
const activitySignalsOf = (client: Client) =>
  clientActivitySignals(client, quotesStore.quotes, projectsStore.projects);
const primaryActivityOf = (client: Client) => activitySignalsOf(client)[0];

const hasAnyClient = computed(() => clientsStore.clients.length > 0);

const sortedClients = computed(() =>
  buildClientList(clientsStore.clients, listState.value, {
    quoteCountOf,
    revenueOf,
    projectCountOf,
  }),
);

// Deux totaux distincts : l'en-tête parle du portefeuille entier, le pied de
// tableau du sous-ensemble filtré. Les mélanger rendrait les deux illisibles.
const globalSignedRevenue = computed(() =>
  clientsStore.clients.reduce((total, client) => total + revenueOf(client), 0),
);
const filteredSignedRevenue = computed(() =>
  sortedClients.value.reduce((total, client) => total + revenueOf(client), 0),
);

const activeFilters = computed(() => {
  const chips: Array<{ key: string; label: string; value: string; clear: () => void }> = [];
  if (search.value.trim()) {
    chips.push({
      key: "q",
      label: "Recherche",
      value: search.value.trim(),
      clear: () => (search.value = ""),
    });
  }
  if (filterStage.value) {
    chips.push({
      key: "etape",
      label: "Relation",
      value: clientStageLabel(filterStage.value),
      clear: () => (filterStage.value = ""),
    });
  }
  if (filterPlatform.value) {
    chips.push({
      key: "plateforme",
      label: "Plateforme",
      value: getQuotePlatformLabel(filterPlatform.value),
      clear: () => (filterPlatform.value = ""),
    });
  }
  return chips;
});

const clearAllFilters = () => {
  search.value = "";
  filterStage.value = "";
  filterPlatform.value = "";
};

const toggleSort = (field: ClientSortField) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === "desc" ? "asc" : "desc";
    return;
  }
  sortField.value = field;
  sortDirection.value = field === "name" ? "asc" : "desc";
};

const formatRelativeDays = (value: unknown): string => {
  const date = toDateObj(value);
  if (!date) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
};

const openClient = (id: string) => {
  void router.push({ name: "client-detail", params: { id }, query: listQuery.value });
};

const openCreateDialog = () => {
  dialogVisible.value = true;
};

// Le dashboard ouvre la création directement : /clients?new=1
watch(
  () => route.query.new,
  (value) => {
    if (value !== "1") return;
    openCreateDialog();
    const query = { ...route.query };
    delete query.new;
    void router.replace({ query });
  },
  { immediate: true },
);

const handleSave = async (payload: ClientInput, id: string | null) => {
  const client = await clientsStore.saveClient(id, payload);
  dialogVisible.value = false;
  toast.add({
    severity: "success",
    summary: "Client enregistré",
    detail: "La fiche client a été créée.",
    life: 2500,
  });
  if (client?.id) openClient(client.id);
};

const menuClient = computed(
  () => clientsStore.clients.find((client) => client.id === menuClientId.value) || null,
);

const confirmDelete = (client: Client) => {
  confirm.require({
    message: `${clientDisplayName(client)} et sa fiche seront définitivement supprimés.`,
    header: "Supprimer ce client ?",
    icon: "warning",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await clientsStore.deleteClient(client.id);
      toast.add({
        severity: "secondary",
        summary: "Client supprimé",
        detail: "La fiche a été retirée.",
        life: 2500,
      });
    },
  });
};

const menuItems = computed(() => [
  {
    label: "Ouvrir",
    icon: "pi pi-arrow-up-right",
    command: () => menuClient.value && openClient(menuClient.value.id),
  },
  {
    label: "Supprimer",
    icon: "pi pi-trash",
    command: () => menuClient.value && confirmDelete(menuClient.value),
  },
]);

const openRowMenu = (event: Event, clientId: string) => {
  menuClientId.value = clientId;
  rowMenu.value?.toggle(event);
};

const columns: Array<{ field: ClientSortField | null; label: string; align?: "right" }> = [
  { field: "name", label: "Client" },
  { field: "stage", label: "Relation" },
  { field: "quotes", label: "Devis", align: "right" },
  { field: "revenue", label: "CA signé", align: "right" },
  { field: "projects", label: "Activité" },
  { field: "updatedAt", label: "Dernière activité" },
];

const initialsOf = (client: Client) =>
  clientDisplayName(client)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">groups</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Clients</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            {{ clientsStore.clients.length }} client{{
              clientsStore.clients.length > 1 ? "s" : ""
            }}
            · {{ formatCurrency(globalSignedRevenue) }} signés · Suivi des fiches et de la
            relation client.
          </p>
        </div>
      </div>
      <Button label="Nouveau client" @click="openCreateDialog">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <section
      v-if="hasAnyClient"
      class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 shadow-sm"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InputText v-model="search" placeholder="Rechercher un client" />
        <Select
          v-model="filterStage"
          :options="clientStageOptions"
          option-label="label"
          option-value="value"
          placeholder="Toutes les relations"
          show-clear
        >
          <template #value="{ value }">
            <Tag
              v-if="value"
              :value="clientStageLabel(value as ClientStage)"
              :class="clientStageTagClass[value as ClientStage]"
              rounded
            />
            <span v-else class="text-surface-dark/50">Toutes les relations</span>
          </template>
          <template #option="{ option }">
            <Tag
              :value="option.label"
              :class="clientStageTagClass[option.value as ClientStage]"
              rounded
            />
          </template>
        </Select>
        <Select
          v-model="filterPlatform"
          :options="platformOptions"
          option-label="label"
          option-value="value"
          placeholder="Toutes les plateformes"
          show-clear
        />
      </div>

      <div v-if="activeFilters.length" class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">
          Filtres actifs
        </span>
        <span
          v-for="chip in activeFilters"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-primary"
        >
          {{ chip.label }} <span class="text-surface-dark">{{ chip.value }}</span>
          <button
            type="button"
            class="flex items-center rounded-full p-0.5 opacity-70 transition hover:opacity-100"
            :aria-label="`Retirer le filtre ${chip.label}`"
            @click="chip.clear()"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </span>
        <button
          type="button"
          class="px-1 py-1 text-xs text-surface-dark/55 underline underline-offset-4 hover:text-surface-dark"
          @click="clearAllFilters"
        >
          Tout effacer
        </button>
      </div>
    </section>

    <section
      v-if="!hasAnyClient && !clientsStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">person_add</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Ajoutez votre premier client</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        La fiche client alimente l'en-tête des devis, la TVA applicable et la langue du contenu
        généré.
      </p>
      <Button class="mt-3" label="Nouveau client" @click="openCreateDialog">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </section>

    <section
      v-else-if="!sortedClients.length && !clientsStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">search_off</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Aucun client ne correspond</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        {{ activeFilters.length }} filtre{{
          activeFilters.length > 1 ? "s sont actifs" : " est actif"
        }}
        :
        {{ activeFilters.map((chip) => `${chip.label.toLowerCase()} ${chip.value}`).join(", ") }}.
      </p>
      <Button
        class="mt-3"
        severity="secondary"
        outlined
        label="Effacer les filtres"
        @click="clearAllFilters"
      />
    </section>

    <section
      v-else-if="sortedClients.length"
      class="overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] border-collapse tabular-nums">
          <thead>
            <tr class="border-b border-surface-dark/12">
              <th
                v-for="column in columns"
                :key="column.label"
                scope="col"
                class="sticky top-0 z-10 whitespace-nowrap bg-surface-card px-4 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-wider first:pl-6"
                :class="[
                  column.align === 'right' ? 'text-right' : 'text-left',
                  sortField === column.field ? 'text-surface-dark/70' : 'text-surface-dark/35',
                ]"
              >
                <button
                  v-if="column.field"
                  type="button"
                  class="inline-flex items-center gap-1 uppercase transition hover:text-surface-dark"
                  @click="toggleSort(column.field)"
                >
                  {{ column.label }}
                  <span
                    v-if="sortField === column.field"
                    class="material-symbols-outlined text-sm"
                    aria-hidden="true"
                  >
                    {{ sortDirection === "desc" ? "arrow_downward" : "arrow_upward" }}
                  </span>
                </button>
                <span v-else>{{ column.label }}</span>
              </th>
              <th scope="col" class="sticky top-0 z-10 w-12 bg-surface-card pr-6"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="client in sortedClients"
              :key="client.id"
              class="group cursor-pointer border-b border-surface-dark/6 transition last:border-b-0 hover:bg-surface-dark/3"
              tabindex="0"
              @click="openClient(client.id)"
              @keydown.enter="openClient(client.id)"
            >
              <td class="px-4 py-3 pl-6">
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {{ initialsOf(client) }}
                  </span>
                  <div class="min-w-0">
                    <div class="max-w-[260px] truncate font-semibold text-surface-dark">
                      {{ clientDisplayName(client) }}
                    </div>
                    <div class="mt-px max-w-[260px] truncate text-xs text-surface-dark/55">
                      <template v-if="client.companyName">{{ client.companyName }} · </template>
                      {{ getCountryFlag(client.country) }}
                      <template v-if="getQuotePlatformLabel(client.platform)">
                        · {{ getQuotePlatformLabel(client.platform) }}
                      </template>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <Tag
                  :value="clientStageLabel(client.stage)"
                  :class="[clientStageTagClass[client.stage], '!whitespace-nowrap']"
                  rounded
                />
              </td>
              <td class="px-4 py-3 text-right text-[13px] text-surface-dark/70">
                {{ quoteCountOf(client) || "—" }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <span
                  :class="
                    revenueOf(client) > 0
                      ? 'font-semibold text-surface-dark'
                      : 'text-surface-dark/40'
                  "
                >
                  {{ revenueOf(client) > 0 ? formatCurrency(revenueOf(client)) : "—" }}
                </span>
              </td>
              <td class="px-4 py-3 text-[13px]">
                <span
                  class="inline-flex max-w-[240px] items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
                  :class="clientActivityToneClass[primaryActivityOf(client).tone]"
                >
                  <span class="material-symbols-outlined text-sm">{{ primaryActivityOf(client).icon }}</span>
                  <span class="truncate">{{ primaryActivityOf(client).label }}</span>
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-[13px] text-surface-dark/70">
                {{ formatRelativeDays(client.updatedAt || client.createdAt) }}
              </td>
              <td class="w-12 py-3 pr-6 text-right">
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-surface-dark/35 opacity-0 transition hover:bg-surface-dark/6 hover:text-surface-dark focus-visible:opacity-100 group-hover:opacity-100"
                  :aria-label="`Actions sur le client ${clientDisplayName(client)}`"
                  @click.stop="openRowMenu($event, client.id)"
                >
                  <span class="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-dark/6 px-6 py-3.5 text-xs text-surface-dark/55"
      >
        <span>
          <strong class="font-semibold text-surface-dark">{{ sortedClients.length }}</strong>
          client{{ sortedClients.length > 1 ? "s" : "" }} sur
          {{ clientsStore.clients.length }} · CA signé filtré
          <strong class="font-semibold text-surface-dark">
            {{ formatCurrency(filteredSignedRevenue) }}
          </strong>
        </span>
        <span>Entrée pour ouvrir une fiche</span>
      </div>
    </section>

    <Menu ref="rowMenu" :model="menuItems" popup />

    <ClientFormDialog v-model:visible="dialogVisible" :client="null" @save="handleSave" />
  </div>
</template>
