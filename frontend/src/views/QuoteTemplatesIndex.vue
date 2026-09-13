<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { QuoteLanguage, QuoteTemplate } from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { languageOptions } from "@/lib/clientPresets";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { formatDateTime } from "@/utils/date";
import { getTemplateLanguageStatus } from "@/utils/quoteTemplateLanguages";

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const quoteTemplatesStore = useQuoteTemplatesStore();

const search = ref("");
const filterKind = ref<"base" | "custom" | "">("");
const filterLanguage = ref<QuoteLanguage | "">("");

const kindOptions = [
  { label: "Base commune", value: "base" },
  { label: "Templates personnalisés", value: "custom" },
];

const languageLabel = (language: QuoteLanguage) =>
  languageOptions.find((option) => option.value === language)?.label || language;
const languages = languageOptions.map((option) => option.value);

const languageStatus = (template: QuoteTemplate, language: QuoteLanguage) =>
  getTemplateLanguageStatus(template, language);

const languageBadgeClass = (template: QuoteTemplate, language: QuoteLanguage) => {
  const status = languageStatus(template, language);
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-surface-dark/10 bg-surface-dark/[0.025] text-surface-dark/30";
};

const searchableText = (template: QuoteTemplate) =>
  [
    template.name,
    template.customPlatformLabel,
    ...languages
      .filter((language) => languageStatus(template, language) !== "empty")
      .map(languageLabel),
    template.kind === "base" ? "base commune" : "personnalisé",
  ]
    .join(" ")
    .toLocaleLowerCase("fr");

const filteredTemplates = computed(() => {
  const query = search.value.trim().toLocaleLowerCase("fr");
  return quoteTemplatesStore.templates.filter((template) => {
    const kind = template.kind || "custom";
    if (filterKind.value && kind !== filterKind.value) return false;
    if (
      filterLanguage.value &&
      languageStatus(template, filterLanguage.value) === "empty"
    ) return false;
    return !query || searchableText(template).includes(query);
  });
});

const contentCount = (template: QuoteTemplate) => {
  const localized = template.localizedContent?.[template.language];
  const parts = localized?.parts || template.parts || [];
  const deliverables = localized?.deliverables || template.deliverables || [];
  return parts.length + deliverables.length;
};

const openTemplate = (templateId: string) =>
  router.push({ name: "quote-template-detail", params: { id: templateId } });

const createTemplate = () => router.push({ name: "quote-template-new" });

const confirmDelete = (event: MouseEvent, template: QuoteTemplate) => {
  event.stopPropagation();
  if (template.kind === "base") return;
  confirm.require({
    message: `Supprimer définitivement ${template.name || "ce template"} ?`,
    header: "Supprimer le template ?",
    icon: "warning",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await quoteTemplatesStore.deleteTemplate(template.id);
      toast.add({
        severity: "secondary",
        summary: "Template supprimé",
        detail: "Le template a été retiré.",
        life: 2200,
      });
    },
  });
};

onMounted(() => quoteTemplatesStore.fetchTemplates());
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">library_books</span>
        </span>
        <div>
          <h1 class="font-heading text-3xl font-bold text-surface-dark">Templates</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            {{ quoteTemplatesStore.templates.length }} template{{ quoteTemplatesStore.templates.length > 1 ? "s" : "" }}
            · Base commune et modèles réutilisables pour vos devis.
          </p>
        </div>
      </div>
      <Button label="Nouveau template" @click="createTemplate">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <section
      v-if="quoteTemplatesStore.templates.length"
      class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 shadow-sm"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InputText v-model="search" placeholder="Rechercher un template" />
        <Select
          v-model="filterKind"
          :options="kindOptions"
          option-label="label"
          option-value="value"
          placeholder="Tous les types"
          show-clear
        />
        <Select
          v-model="filterLanguage"
          :options="languageOptions"
          option-label="label"
          option-value="value"
          placeholder="Toutes les langues"
          show-clear
        />
      </div>
    </section>

    <section
      v-if="!quoteTemplatesStore.loading && !quoteTemplatesStore.templates.length"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">library_add</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Créez votre premier template</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        Les templates permettent de réutiliser une structure de devis, ses contenus et ses conditions.
      </p>
      <Button class="mt-3" label="Nouveau template" @click="createTemplate" />
    </section>

    <section
      v-else-if="!quoteTemplatesStore.loading && !filteredTemplates.length"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="material-symbols-outlined text-2xl text-surface-dark/35">search_off</span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Aucun template ne correspond</h2>
      <Button
        class="mt-2"
        severity="secondary"
        outlined
        label="Effacer les filtres"
        @click="search = ''; filterKind = ''; filterLanguage = ''"
      />
    </section>

    <section
      v-else-if="filteredTemplates.length"
      class="overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[820px] border-collapse">
          <thead>
            <tr class="border-b border-surface-dark/12">
              <th class="px-4 pb-3 pt-4 pl-6 text-left text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">Template</th>
              <th class="px-4 pb-3 pt-4 text-left text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">Type</th>
              <th class="px-4 pb-3 pt-4 text-left text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">Langues</th>
              <th class="px-4 pb-3 pt-4 text-right text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">Sections</th>
              <th class="px-4 pb-3 pt-4 text-left text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">Dernière modification</th>
              <th class="w-12 pr-6"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="template in filteredTemplates"
              :key="template.id"
              class="group cursor-pointer border-b border-surface-dark/6 transition last:border-b-0 hover:bg-surface-dark/3"
              tabindex="0"
              @click="openTemplate(template.id)"
              @keydown.enter="openTemplate(template.id)"
            >
              <td class="px-4 py-3 pl-6">
                <div class="flex items-center gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span class="material-symbols-outlined text-lg">{{ template.kind === "base" ? "verified" : "description" }}</span>
                  </span>
                  <span class="max-w-[280px] truncate font-semibold text-surface-dark">{{ template.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="template.kind === 'base' ? 'bg-primary/10 text-primary' : 'bg-surface-dark/6 text-surface-dark/60'"
                >
                  {{ template.kind === "base" ? "Base commune" : "Personnalisé" }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <span
                    v-for="language in languages"
                    :key="language"
                    class="inline-flex min-w-8 justify-center rounded-full border px-2 py-1 text-[11px] font-bold uppercase"
                    :class="languageBadgeClass(template, language)"
                    :title="`${languageLabel(language)} — ${languageStatus(template, language) === 'complete' ? 'complet' : languageStatus(template, language) === 'partial' ? 'incomplet' : 'non renseigné'}`"
                  >{{ language }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-right text-sm text-surface-dark/70">{{ contentCount(template) || "—" }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-surface-dark/60">
                {{ formatDateTime(template.updatedAt || template.createdAt) }}
              </td>
              <td class="w-12 py-3 pr-6 text-right">
                <button
                  v-if="template.kind !== 'base'"
                  type="button"
                  class="rounded-lg p-1.5 text-surface-dark/30 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                  :aria-label="`Supprimer ${template.name}`"
                  @click="confirmDelete($event, template)"
                >
                  <span class="material-symbols-outlined text-lg">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="border-t border-surface-dark/6 px-6 py-3.5 text-xs text-surface-dark/55">
        <strong class="font-semibold text-surface-dark">{{ filteredTemplates.length }}</strong>
        template{{ filteredTemplates.length > 1 ? "s" : "" }} sur {{ quoteTemplatesStore.templates.length }} · Entrée pour ouvrir
      </div>
    </section>
  </div>
</template>
