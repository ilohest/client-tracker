<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { useTimesheetsStore } from "@/stores/timesheetsStore";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import Menu from "primevue/menu";
import Drawer from "primevue/drawer";

const authStore = useAuthStore();
const clientsStore = useClientsStore();
const quotesStore = useQuotesStore();
const quoteTemplatesStore = useQuoteTemplatesStore();
const timesheetsStore = useTimesheetsStore();
const route = useRoute();
const router = useRouter();
const isQuotePreviewMode = computed(
  () => route.path === "/quotes" && route.query.preview === "live",
);

// --- ETAT COMMUN ---
const mobileMenuOpen = ref(false);
const userMenu = ref();
const searchInput = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const searchFocused = ref(false);
const searchLoading = ref(false);
let closeSearchTimer: ReturnType<typeof setTimeout> | null = null;

const toggleUserMenu = (event: any) => {
  userMenu.value.toggle(event);
};

// --- NAVIGATION ---
// 1. Liens Principaux (Accessibles à tous ou connectés)
const mainLinks = computed(() => [
  { label: "Tableau de bord", icon: "home", to: "/" },
  { label: "Devis", icon: "receipt_long", to: "/quotes" },
  { label: "Timesheets", icon: "timer", to: "/timesheets" },
  { label: "Clients", icon: "groups", to: "/clients" },
  { label: "Templates", icon: "library_books", to: "/quote-templates" },
  { label: "Design des devis", icon: "palette", to: "/quote-design" },
  { label: "Infos profil", icon: "badge", to: "/profile" },
  { label: "Documentation", icon: "menu_book", to: "/documentation" },
]);

// 2. Liens Admin (Sous-menu)
const adminLinks = computed(() => {
  if (!authStore.isAdmin) return [];

  const links = [
    { label: "Vue d'ensemble", icon: "dashboard", to: "/admin" }, // Le Hub
  ];

  // On peut choisir de mettre les sous-liens ici pour un accès rapide en Sidebar
  // OU de laisser l'utilisateur passer par le Dashboard Admin.
  // Pour une UX "Pro", c'est bien d'avoir l'accès direct en sidebar :

  links.push({ label: "Utilisateurs", icon: "group", to: "/admin/users" });

  return links;
});

const userMenuItems = [
  {
    label: "Sécurité",
    icon: "lock",
    command: () => router.push("/security"),
  },
  { separator: true },
  {
    label: "Déconnexion",
    icon: "logout",
    class: "text-red-500",
    command: () => authStore.logoutUser(),
  },
];

const userInitials = computed(() =>
  authStore.user?.displayName
    ? authStore.user.displayName.substring(0, 2).toUpperCase()
    : authStore.user?.email?.substring(0, 2).toUpperCase() || "U",
);

type GlobalSearchResult = {
  id: string;
  type: "quote" | "client" | "template" | "page";
  title: string;
  subtitle: string;
  icon: string;
  path: string;
  action?: () => void;
};

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const pageResults = computed<GlobalSearchResult[]>(() => [
  ...mainLinks.value.map((link) => ({
    id: `page-${link.to}`,
    type: "page" as const,
    title: link.label,
    subtitle: "Page",
    icon: link.icon,
    path: link.to,
  })),
  ...adminLinks.value.map((link) => ({
    id: `page-${link.to}`,
    type: "page" as const,
    title: link.label,
    subtitle: "Administration",
    icon: link.icon,
    path: link.to,
  })),
]);

const globalSearchResults = computed<GlobalSearchResult[]>(() => {
  const query = normalizeSearch(searchQuery.value);
  if (!query) return [];

  const quoteResults = quotesStore.quotes.map((quote) => ({
    id: `quote-${quote.id}`,
    type: "quote" as const,
    title: quote.title || quote.clientName || quote.quoteRef || "Devis sans titre",
    subtitle: [quote.quoteRef, quote.clientName].filter(Boolean).join(" · ") || "Devis",
    icon: "receipt_long",
    path: "/quotes",
    action: () => quotesStore.selectQuote(quote.id),
  }));

  const clientResults = clientsStore.clients.map((client) => ({
    id: `client-${client.id}`,
    type: "client" as const,
    title: client.name || "Client sans nom",
    subtitle: [client.contactEmail, client.website].filter(Boolean).join(" · ") || "Client",
    icon: "groups",
    path: "/clients",
    action: () => clientsStore.selectClient(client.id),
  }));

  const templateResults = quoteTemplatesStore.templates.map((template) => ({
    id: `template-${template.id}`,
    type: "template" as const,
    title: template.name || "Template sans nom",
    subtitle: template.kind === "base" ? "Réglage commun" : "Template",
    icon: template.kind === "base" ? "tune" : "library_books",
    path: "/quote-templates",
    action: () => quoteTemplatesStore.selectTemplate(template.id),
  }));

  const timesheetResults = timesheetsStore.timesheets.map((timesheet) => ({
    id: `timesheet-${timesheet.id}`,
    type: "page" as const,
    title: timesheet.title || "Timesheet sans titre",
    subtitle: [timesheet.clientName, timesheet.quoteRef].filter(Boolean).join(" · ") || "Timesheet",
    icon: "timer",
    path: "/timesheets",
    action: () => timesheetsStore.selectTimesheet(timesheet.id),
  }));

  return [...quoteResults, ...clientResults, ...timesheetResults, ...templateResults, ...pageResults.value]
    .filter((result) =>
      normalizeSearch(`${result.title} ${result.subtitle}`).includes(query),
    )
    .slice(0, 8);
});

const ensureSearchData = async () => {
  if (searchLoading.value) return;
  const tasks: Promise<void>[] = [];
  if (!quotesStore.quotes.length) tasks.push(quotesStore.fetchQuotes());
  if (!clientsStore.clients.length) tasks.push(clientsStore.fetchClients());
  if (!quoteTemplatesStore.templates.length) tasks.push(quoteTemplatesStore.fetchTemplates());
  if (!timesheetsStore.timesheets.length) tasks.push(timesheetsStore.fetchTimesheets());
  if (!tasks.length) return;

  searchLoading.value = true;
  try {
    await Promise.all(tasks);
  } catch (error) {
    console.warn("Recherche globale: certaines données n'ont pas pu être chargées.", error);
  } finally {
    searchLoading.value = false;
  }
};

const focusGlobalSearch = () => {
  searchFocused.value = true;
  void ensureSearchData();
  searchInput.value?.focus();
};

const handleSearchFocus = () => {
  if (closeSearchTimer) clearTimeout(closeSearchTimer);
  searchFocused.value = true;
  void ensureSearchData();
};

const handleSearchBlur = () => {
  closeSearchTimer = setTimeout(() => {
    searchFocused.value = false;
  }, 140);
};

const openSearchResult = (result: GlobalSearchResult) => {
  result.action?.();
  searchQuery.value = "";
  searchFocused.value = false;
  router.push(result.path);
};

const openFirstSearchResult = () => {
  const [firstResult] = globalSearchResults.value;
  if (firstResult) openSearchResult(firstResult);
};

const handleGlobalShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusGlobalSearch();
  }
};

onMounted(() => window.addEventListener("keydown", handleGlobalShortcut));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalShortcut);
  if (closeSearchTimer) clearTimeout(closeSearchTimer);
});
</script>

<template>
  <div class="min-h-screen bg-[#f8f7fa] flex flex-col">
    <aside
      class="hidden lg:flex flex-col bg-white border-r border-surface-dark/5 fixed h-full z-20 shadow-[0_2px_10px_rgba(47,43,61,0.08)] transition-[width] duration-200"
      :class="isQuotePreviewMode ? 'w-20' : 'w-64'"
    >
      <div
        class="h-20 flex items-center shrink-0"
        :class="isQuotePreviewMode ? 'justify-center px-3' : 'px-5'"
      >
        <img
          src="/img/logo.png"
          alt="Devisio"
          class="object-contain transition-all duration-200"
          :class="isQuotePreviewMode ? 'h-10 w-10 object-left' : 'w-full'"
        />
      </div>

      <nav
        class="flex-1 overflow-y-auto py-6 flex flex-col gap-1 custom-scrollbar"
        :class="isQuotePreviewMode ? 'px-2' : 'px-3'"
      >
        <router-link
          v-for="link in mainLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center rounded-lg text-sm font-medium transition-colors border border-transparent"
          :class="[
            isQuotePreviewMode ? 'justify-center gap-0 px-2 py-2.5' : 'gap-3 px-3 py-2',
            route.path === link.to
              ? 'bg-primary text-white border-primary shadow-[0_3px_8px_rgba(233,106,95,0.35)]'
              : 'text-surface-dark/70 hover:bg-surface-dark/[0.055] hover:text-surface-dark',
          ]"
          :title="isQuotePreviewMode ? link.label : undefined"
        >
          <span
            class="material-symbols-outlined"
            :class="[
              route.path === link.to ? 'text-white' : 'text-surface-dark/50',
            ]"
            >{{ link.icon }}</span
          >
          <span v-if="!isQuotePreviewMode">{{ link.label }}</span>
        </router-link>

        <div
          v-if="authStore.isAdmin && adminLinks.length > 0 && !isQuotePreviewMode"
          class="mt-6 mb-2 px-3"
        >
          <span
            class="text-[10px] uppercase font-bold text-surface-dark/40 tracking-wider"
            >Administration</span
          >
        </div>

        <router-link
          v-if="authStore.isAdmin"
          v-for="link in adminLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center rounded-lg text-sm font-medium transition-colors border border-transparent"
          :class="[
            isQuotePreviewMode ? 'justify-center gap-0 px-2 py-2.5' : 'gap-3 px-3 py-2',
            route.path === link.to
              ? 'bg-primary text-white border-primary shadow-[0_3px_8px_rgba(233,106,95,0.35)]'
              : 'text-surface-dark/60 hover:bg-surface-dark/[0.055] hover:text-surface-dark',
          ]"
          :title="isQuotePreviewMode ? link.label : undefined"
        >
          <span
            class="material-symbols-outlined"
            :class="route.path === link.to ? 'text-white' : 'text-surface-dark/50'"
          >{{
            link.icon
          }}</span>
          <span v-if="!isQuotePreviewMode">{{ link.label }}</span>
        </router-link>
      </nav>

      <div class="border-t border-surface-dark/5 shrink-0" :class="isQuotePreviewMode ? 'p-2' : 'p-4'">
        <div
          class="flex items-center rounded-xl hover:bg-surface-dark/5 cursor-pointer transition-colors"
          :class="isQuotePreviewMode ? 'justify-center p-2' : 'gap-3 p-2'"
          @click="toggleUserMenu"
          aria-haspopup="true"
          aria-controls="user_menu"
        >
          <Avatar
            :label="userInitials"
            shape="circle"
            class="bg-primary text-white shadow-sm font-bold shrink-0"
          />
          <div v-if="!isQuotePreviewMode" class="flex-1 min-w-0">
            <p class="text-sm font-bold text-surface-dark truncate">
              {{ authStore.user?.displayName || "Utilisateur" }}
            </p>
          </div>
          <span v-if="!isQuotePreviewMode" class="material-symbols-outlined text-xs text-surface-dark/30"
            >more_vert</span
          >
        </div>
      </div>
    </aside>

    <main
      class="flex-1 flex flex-col min-h-screen pt-16 lg:pt-0 transition-[padding] duration-200"
      :class="isQuotePreviewMode ? 'lg:pl-20' : 'lg:pl-64'"
    >
      <div class="hidden lg:block px-7 pt-4">
        <div
          class="flex h-14 items-center justify-between rounded-md border border-surface-dark/5 bg-white px-5 shadow-[0_2px_10px_rgba(47,43,61,0.08)]"
        >
          <div class="relative flex min-w-0 flex-1 items-center gap-3 text-surface-dark/45">
            <span class="material-symbols-outlined text-[22px]">search</span>
            <input
              ref="searchInput"
              v-model="searchQuery"
              class="h-10 min-w-0 flex-1 bg-transparent text-sm text-surface-dark outline-none placeholder:text-surface-dark/35"
              type="search"
              placeholder="Rechercher un devis, client, template..."
              autocomplete="off"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
              @keydown.enter.prevent="openFirstSearchResult"
              @keydown.escape.prevent="searchFocused = false"
            />
            <button
              type="button"
              class="rounded-md border border-surface-dark/10 px-1.5 py-0.5 text-xs text-surface-dark/35 transition-colors hover:border-primary/30 hover:text-primary"
              @click="focusGlobalSearch"
            >
              ⌘K
            </button>

            <div
              v-if="searchFocused && searchQuery.trim()"
              class="absolute left-[-0.5rem] right-0 top-[calc(100%+0.75rem)] z-50 overflow-hidden rounded-md border border-surface-dark/8 bg-white shadow-[0_8px_28px_rgba(47,43,61,0.14)]"
            >
              <div v-if="searchLoading" class="px-4 py-3 text-sm text-surface-dark/50">
                Recherche en cours...
              </div>
              <button
                v-for="result in globalSearchResults"
                :key="result.id"
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-dark/[0.045]"
                @mousedown.prevent="openSearchResult(result)"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                >
                  <span class="material-symbols-outlined text-[20px]">{{ result.icon }}</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-surface-dark">
                    {{ result.title }}
                  </span>
                  <span class="block truncate text-xs text-surface-dark/50">
                    {{ result.subtitle }}
                  </span>
                </span>
              </button>
              <div
                v-if="!searchLoading && globalSearchResults.length === 0"
                class="px-4 py-3 text-sm text-surface-dark/50"
              >
                Aucun résultat.
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <Avatar
              :label="userInitials"
              shape="circle"
              @click="toggleUserMenu"
              class="ml-2 cursor-pointer bg-primary text-white shadow-sm"
            />
          </div>
        </div>
      </div>

      <div
        class="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-surface-dark/5 z-30 flex items-center justify-between px-4 shadow-[0_2px_10px_rgba(47,43,61,0.08)]"
      >
        <div class="flex items-center gap-3">
          <Button text @click="mobileMenuOpen = true">
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >menu</span
              ></template
            >
          </Button>
          <img
            src="/img/logo.png"
            alt="Devisio"
            class="h-7 w-auto max-w-[130px] object-contain"
          />
        </div>
        <Avatar
          :label="userInitials"
          shape="circle"
          @click="toggleUserMenu"
          class="bg-primary text-white"
        />
      </div>

      <div class="p-4 sm:p-7 flex-1">
        <router-view />
      </div>
    </main>

    <Drawer v-model:visible="mobileMenuOpen">
      <template #header>
        <div class="flex items-center gap-2">
          <img
            src="/img/logo.png"
            alt="Devisio"
            class="h-7 w-auto max-w-[130px] object-contain"
          />
        </div>
      </template>
      <nav class="flex flex-col gap-2 mt-4">
        <router-link
          v-for="link in mainLinks"
          :key="link.to"
          :to="link.to"
          @click="mobileMenuOpen = false"
          class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors"
          :class="
            route.path === link.to
              ? 'bg-primary/10 text-primary'
              : 'text-surface-dark/70 hover:bg-surface-dark/5'
          "
        >
          <span class="material-symbols-outlined text-lg">{{ link.icon }}</span>
          {{ link.label }}
        </router-link>

        <div
          v-if="authStore.isAdmin"
          class="my-2 border-t border-surface-dark/5"
        ></div>
        <div
          v-if="authStore.isAdmin"
          class="px-3 text-[10px] font-bold text-surface-dark/40 uppercase"
        >
          Admin
        </div>

        <router-link
          v-if="authStore.isAdmin"
          v-for="link in adminLinks"
          :key="link.to"
          :to="link.to"
          @click="mobileMenuOpen = false"
          class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-surface-dark/70 hover:bg-surface-dark/5"
        >
          <span class="material-symbols-outlined text-lg">{{ link.icon }}</span>
          {{ link.label }}
        </router-link>
      </nav>
    </Drawer>

    <Menu ref="userMenu" id="user_menu" :model="userMenuItems" :popup="true">
      <template #itemicon="{ item }">
        <span class="material-symbols-outlined text-lg">{{ item.icon }}</span>
      </template>
    </Menu>
  </div>
</template>

<style scoped>
/* Petit utilitaire pour la scrollbar custom si besoin */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
