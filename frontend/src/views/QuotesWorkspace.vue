<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import type {
  ClientInput,
  Quote,
  QuoteAddon,
  QuoteCondition,
  QuoteConditionItem,
  QuoteConditionSubItem,
  QuoteDiscountType,
  QuoteInput,
  QuoteLanguage,
  QuoteStatus,
  QuoteTemplate,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import ClientFormDialog from "@/components/clients/ClientFormDialog.vue";
import QuoteActionBar from "@/components/quotes/QuoteActionBar.vue";
import QuoteBuilderForm from "@/components/quotes/QuoteBuilderForm.vue";
import QuoteListPanel from "@/components/quotes/QuoteListPanel.vue";
import QuoteOutputPanel from "@/components/quotes/QuoteOutputPanel.vue";
import QuoteTablePanel from "@/components/quotes/QuoteTablePanel.vue";
import {
  createAddonPresets,
  createBlankAddon,
  createDefaultQuoteAcceptance,
  createDefaultQuoteConditions,
  createDefaultQuotePrinciples,
  createDefaultQuoteRoadmap,
} from "@/lib/clientPresets";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { formatClientAddress, formatClientFullName } from "@/utils/address";
import { copyToClipboard } from "@/utils/clipboard";
import { printQuoteDocument } from "@/utils/quotePdf";
import {
  calculateAddonTotal,
  calculateQuotePartsTotals,
  cloneQuoteParts,
  createEmptyQuotePart,
  createEntityId,
  createQuoteVersionInput,
  duplicateQuoteInput,
  formatQuoteDate,
  generateQuoteReference,
  getQuotePlatformLabel,
  getQuoteValidityDate,
  getTodayQuoteDate,
  parseQuoteDate,
} from "@/utils/quote";
import { computeVatRateForClient, getVatExplanation } from "@/utils/vat";
import { useRouter } from "vue-router";

type QuoteDraft = QuoteInput;

const router = useRouter();
const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();
const quoteTemplatesStore = useQuoteTemplatesStore();
const authStore = useAuthStore();
const toast = useToast();
const clientDialogVisible = ref(false);
const mobileEditorVisible = ref(false);
const isCompactQuotesView = ref(false);
const quoteSearch = ref("");
const quoteFilterClientId = ref("");
const quoteFilterDate = ref<Date | null>(null);
const quoteFilterStatus = ref<QuoteStatus | "">("");
const selectedTemplateId = ref<string | null>("");
const lastAutoEmailDraft = ref("");
const unsavedAttention = ref(false);
// Empêche les watchers de régénérer le contenu par défaut pendant le chargement
// d'un devis (sinon le formulaire diffère toujours de la référence → faux « modifié »).
let hydratingQuote = false;

let unsavedAttentionTimeout: ReturnType<typeof setTimeout> | null = null;

const syncCompactMode = () => {
  isCompactQuotesView.value = window.innerWidth < 1024;
};

const createDraft = (): QuoteDraft => ({
  clientId: "",
  title: "",
  quoteDate: getTodayQuoteDate(),
  quoteRef: generateQuoteReference(""),
  platform: "shopify",
  customPlatformLabel: "",
  language: "fr",
  clientName: "",
  clientAddress: "",
  clientWebsite: "",
  vatRate: 21,
  projectSummary: "",
  emailDraft: "",
  emailSubject: "",
  emailBody: "",
  discountType: "percent",
  discountValue: 0,
  version: 1,
  versionGroupId: createEntityId(),
  parts: [createEmptyQuotePart()],
  conditions: createDefaultQuoteConditions("shopify", "fr"),
  roadmap: createDefaultQuoteRoadmap("shopify", "fr"),
  acceptance: createDefaultQuoteAcceptance("fr"),
  principles: createDefaultQuotePrinciples("fr"),
  addons: createAddonPresets("fr"),
  status: "draft",
});

const cloneTemplateLocalizedSlice = (
  slice?: Partial<QuoteTemplateLocalizedContent> | null,
): QuoteTemplateLocalizedContent => ({
  projectSummary: slice?.projectSummary || "",
  parts: (slice?.parts || []).map((part) => ({
    ...part,
    id: part.id || createEntityId(),
    sections: (part.sections || []).map((section) => ({
      ...section,
      id: section.id || createEntityId(),
      items: (section.items || []).map((item) => ({
        id: item.id || createEntityId(),
        text: item.text || "",
        subItems: (item.subItems || []).map((subItem) => ({
          id: subItem.id || createEntityId(),
          text: subItem.text || "",
        })),
      })),
      subSections: (section.subSections || []).map((subSection) => ({
        ...subSection,
        id: subSection.id || createEntityId(),
      })),
    })),
  })),
  conditions: (slice?.conditions || []).map((condition) => ({
    ...condition,
    id: condition.id || createEntityId(),
    items: normalizeConditionItems(condition).map((item) => ({
      id: item.id || createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: subItem.id || createEntityId(),
        text: subItem.text || "",
      })),
    })),
  })),
  roadmap: (slice?.roadmap || []).map((phase) => ({
    ...phase,
    id: phase.id || createEntityId(),
    items: normalizeConditionItems(phase).map((item) => ({
      id: item.id || createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: subItem.id || createEntityId(),
        text: subItem.text || "",
      })),
    })),
  })),
  acceptance: (slice?.acceptance || []).map((entry) => ({
    ...entry,
    id: entry.id || createEntityId(),
    items: normalizeConditionItems(entry).map((item) => ({
      id: item.id || createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: subItem.id || createEntityId(),
        text: subItem.text || "",
      })),
    })),
  })),
  principles: (slice?.principles || []).map((principle) => ({
    ...principle,
    id: principle.id || createEntityId(),
    items: normalizeConditionItems(principle).map((item) => ({
      id: item.id || createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: subItem.id || createEntityId(),
        text: subItem.text || "",
      })),
    })),
  })),
  addons: (slice?.addons || []).map((addon) => ({
    ...addon,
    id: addon.id || createEntityId(),
    unitLabel: addon.unitLabel || "",
    items: normalizeAddonItems(addon).map((item) => ({
      id: item.id || createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: subItem.id || createEntityId(),
        text: subItem.text || "",
      })),
    })),
  })),
});

const resolveTemplateContent = (
  template: QuoteTemplate,
  language: QuoteLanguage,
): QuoteTemplateLocalizedContent => {
  const localizedSlice = template.localizedContent?.[language];
  if (localizedSlice) return cloneTemplateLocalizedSlice(localizedSlice);

  return cloneTemplateLocalizedSlice({
    projectSummary: template.projectSummary || "",
    parts: template.parts,
    conditions: template.conditions,
    roadmap: template.roadmap,
    acceptance: template.acceptance,
    principles: template.principles,
    addons: template.addons,
  });
};

const createDraftFromTemplate = (
  template: QuoteTemplate,
  languageOverride?: QuoteLanguage,
): QuoteDraft => {
  const targetLanguage = languageOverride || template.language;
  const localizedContent = resolveTemplateContent(template, targetLanguage);

  return {
    clientId: "",
    title: "",
    quoteDate: getTodayQuoteDate(),
    quoteRef: generateQuoteReference(""),
    platform: template.platform,
    customPlatformLabel: template.customPlatformLabel || "",
    language: targetLanguage,
    clientName: "",
    clientAddress: "",
    clientWebsite: "",
    vatRate: 21,
    projectSummary: localizedContent.projectSummary,
    emailDraft: "",
    emailSubject: "",
    emailBody: "",
    discountType: template.discountType || "percent",
    discountValue: template.discountValue || 0,
    version: 1,
    versionGroupId: createEntityId(),
    parts: cloneQuoteParts(localizedContent.parts),
    conditions: localizedContent.conditions,
    roadmap: localizedContent.roadmap,
    acceptance: localizedContent.acceptance,
    principles: localizedContent.principles,
    addons: localizedContent.addons,
    status: "draft",
  };
};

const buildStandardQuoteEmail = (payload: {
  language: QuoteLanguage;
  clientName: string;
  title: string;
  quoteRef: string;
}): { subject: string; body: string } => {
  const clientGreeting = payload.clientName || "";
  const quoteTitle = payload.title || "";
  const quoteLabel =
    quoteTitle && payload.quoteRef
      ? `${quoteTitle} (${payload.quoteRef})`
      : quoteTitle || payload.quoteRef || "";

  if (payload.language === "en") {
    return {
      subject: quoteLabel ? `Quote proposal - ${quoteLabel}` : "Quote proposal",
      body: `${clientGreeting ? `Hi ${clientGreeting},` : "Hi,"}

Please find attached the quote${quoteTitle ? ` for ${quoteTitle}` : ""}.

If everything looks good to you, you can simply confirm by replying to this email and I will take care of the next steps. If you would like to adjust anything, I can of course update the quote accordingly.

Kind regards,`,
    };
  }

  if (payload.language === "es") {
    return {
      subject: quoteLabel
        ? `Propuesta de presupuesto - ${quoteLabel}`
        : "Propuesta de presupuesto",
      body: `${clientGreeting ? `Hola ${clientGreeting},` : "Hola,"}

Te adjunto el presupuesto${quoteTitle ? ` para ${quoteTitle}` : ""}.

Si todo te encaja, puedes confirmármelo respondiendo a este correo y me encargaré de los siguientes pasos. Si quieres ajustar algún punto, por supuesto puedo actualizar el presupuesto.

Un saludo,`,
    };
  }

  return {
    subject: quoteLabel
      ? `Proposition de devis - ${quoteLabel}`
      : "Proposition de devis",
    body: `${clientGreeting ? `Bonjour ${clientGreeting},` : "Bonjour,"}

Vous trouverez ci-joint le devis${quoteTitle ? ` pour ${quoteTitle}` : ""}.

Si tout vous convient, vous pouvez simplement me le confirmer par retour d’email et je m’occuperai de la suite. Si vous souhaitez ajuster un point, je peux bien entendu mettre le devis à jour.

Bien à vous,`,
  };
};

const form = reactive<QuoteDraft>(createDraft());

const buildCurrentStandardEmail = (): { subject: string; body: string } =>
  buildStandardQuoteEmail({
    language: form.language,
    clientName: form.clientName,
    title: form.title,
    quoteRef: form.quoteRef,
  });

const splitLegacyEmailDraft = (
  emailDraft: string,
): { subject: string; body: string } => {
  const trimmed = emailDraft.trim();
  if (!trimmed) return { subject: "", body: "" };

  const [firstLine, ...rest] = trimmed.split("\n");
  const subjectMatch = firstLine.match(/^(Subject|Objet|Asunto)\s*:\s*(.+)$/i);
  if (!subjectMatch) return { subject: "", body: trimmed };

  return {
    subject: subjectMatch[2]?.trim() || "",
    body: rest.join("\n").trim(),
  };
};

const composeLegacyEmailDraft = (
  subject: string,
  body: string,
  language: QuoteLanguage,
): string => {
  const prefix =
    language === "en" ? "Subject" : language === "es" ? "Asunto" : "Objet";
  if (!subject.trim()) return body.trim();
  if (!body.trim()) return `${prefix}: ${subject.trim()}`;
  return `${prefix}: ${subject.trim()}\n\n${body.trim()}`;
};

const buildConditionItemsFromBody = (body: string): QuoteConditionItem[] =>
  body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      id: createEntityId(),
      text: chunk.replace(/^[•\-]\s*/, ""),
      subItems: [],
    }));

const cloneConditionItems = (
  items: QuoteConditionItem[] = [],
): QuoteConditionItem[] =>
  items.map((item) => ({
    id: item.id || createEntityId(),
    text: item.text || "",
    subItems: (item.subItems || []).map((subItem) => ({
      id: subItem.id || createEntityId(),
      text: subItem.text || "",
    })),
  }));

const normalizeConditionItems = (
  condition: QuoteCondition,
): QuoteConditionItem[] => {
  if (condition.items?.length) return cloneConditionItems(condition.items);
  return buildConditionItemsFromBody(condition.body || "");
};

const normalizeAddonItems = (addon: QuoteAddon): QuoteConditionItem[] => {
  if (addon.items?.length) return cloneConditionItems(addon.items);
  return buildConditionItemsFromBody(addon.description || "");
};

const normalizeDraft = (draft: QuoteDraft) => ({
  clientId: draft.clientId,
  title: draft.title,
  quoteDate: draft.quoteDate,
  quoteRef: draft.quoteRef,
  platform: draft.platform,
  customPlatformLabel: draft.customPlatformLabel,
  language: draft.language,
  clientName: draft.clientName,
  clientAddress: draft.clientAddress,
  clientWebsite: draft.clientWebsite,
  vatRate: draft.vatRate,
  projectSummary: draft.projectSummary,
  emailDraft: draft.emailDraft,
  emailSubject: draft.emailSubject,
  emailBody: draft.emailBody,
  discountType: draft.discountType,
  discountValue: draft.discountValue,
  status: draft.status,
  parts: draft.parts.map((part) => ({
    title: part.title,
    displayStyle: part.displayStyle,
    price: part.price,
    optional: part.optional,
    priceNote: part.priceNote,
    sections: (part.sections || []).map((section) => ({
      title: section.title,
      description: section.description,
      items: (section.items || []).map((item) => ({
        text: item.text,
        subItems: (item.subItems || []).map((subItem) => ({
          text: subItem.text,
        })),
      })),
      price: section.price,
      subSections: (section.subSections || []).map((subSection) => ({
        title: subSection.title,
        body: subSection.body,
      })),
    })),
  })),
  conditions: draft.conditions.map((condition) => ({
    title: condition.title,
    body: condition.body,
    items: normalizeConditionItems(condition).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  roadmap: draft.roadmap.map((phase) => ({
    title: phase.title,
    body: phase.body,
    items: normalizeConditionItems(phase).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  acceptance: draft.acceptance.map((entry) => ({
    title: entry.title,
    body: entry.body,
    items: normalizeConditionItems(entry).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  principles: draft.principles.map((principle) => ({
    title: principle.title,
    body: principle.body,
    items: normalizeConditionItems(principle).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  addons: draft.addons.map((addon) => ({
    title: addon.title,
    description: addon.description,
    items: normalizeAddonItems(addon).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
    price: addon.price,
    unitLabel: addon.unitLabel || "",
  })),
});

const totals = computed(() => ({
  ...calculateQuotePartsTotals(
    form.parts,
    form.vatRate,
    form.discountType,
    form.discountValue,
  ),
  addonsTotal: calculateAddonTotal(form.addons),
}));

const currencyLocale = computed(() =>
  form.language === "en" ? "en-GB" : form.language === "es" ? "es-ES" : "fr-FR",
);
const quoteDateModel = computed(() =>
  form.quoteDate ? parseQuoteDate(form.quoteDate) : null,
);
const validUntil = computed(() =>
  formatQuoteDate(getQuoteValidityDate(form.quoteDate)),
);
const selectedClient = computed(
  () =>
    clientsStore.clients.find((entry) => entry.id === form.clientId) || null,
);
const vatExplanation = computed(() =>
  getVatExplanation(selectedClient.value, authStore.userProfile),
);
const templateOptions = computed(() =>
  quoteTemplatesStore.templates.map((template) => ({
    label: template.name,
    value: template.id,
  })),
);
const defaultTemplateName = computed(
  () => quoteTemplatesStore.defaultTemplate?.name || "",
);
// Ouvre l'atelier Templates sur la base par défaut (contenu commun des nouveaux devis).
const editDefaultBase = () => {
  const def = quoteTemplatesStore.defaultTemplate;
  if (def) quoteTemplatesStore.selectTemplate(def.id);
  router.push("/quote-templates");
};
const baselineDraft = computed<QuoteDraft>(() => {
  const current = quotesStore.selectedQuote;
  if (!current) return createDraft();

  return {
    clientId: current.clientId || "",
    title: current.title || "",
    quoteDate: current.quoteDate || getTodayQuoteDate(),
    quoteRef: current.quoteRef,
    platform: current.platform,
    customPlatformLabel: current.customPlatformLabel || "",
    language: current.language,
    clientName: current.clientName,
    clientAddress: current.clientAddress,
    clientWebsite: current.clientWebsite,
    vatRate: current.vatRate,
    projectSummary: current.projectSummary,
    emailDraft: current.emailDraft,
    emailSubject: current.emailSubject || "",
    emailBody: current.emailBody || "",
    discountType: current.discountType || "percent",
    discountValue: current.discountValue || 0,
    version: current.version || 1,
    versionGroupId: current.versionGroupId || current.id,
    parts: cloneQuoteParts(current.parts),
    conditions: current.conditions.map((condition) => ({
      ...condition,
      items: normalizeConditionItems(condition),
    })),
    roadmap: (current.roadmap || []).map((phase) => ({
      ...phase,
      items: normalizeConditionItems(phase),
    })),
    acceptance: (current.acceptance || []).map((entry) => ({
      ...entry,
      items: normalizeConditionItems(entry),
    })),
    principles: (current.principles || []).map((principle) => ({
      ...principle,
      items: normalizeConditionItems(principle),
    })),
    addons: current.addons.map((addon) => ({
      ...addon,
      unitLabel: addon.unitLabel || "",
      items: normalizeAddonItems(addon),
    })),
    status: current.status,
  };
});
const hasUnsavedChanges = computed(
  () =>
    JSON.stringify(normalizeDraft(form)) !==
    JSON.stringify(normalizeDraft(baselineDraft.value)),
);
const filteredQuotes = computed(() => {
  const query = quoteSearch.value.trim().toLowerCase();
  const clientId = quoteFilterClientId.value;
  const filterDate = quoteFilterDate.value
    ? `${quoteFilterDate.value.getFullYear()}-${`${quoteFilterDate.value.getMonth() + 1}`.padStart(2, "0")}-${`${quoteFilterDate.value.getDate()}`.padStart(2, "0")}`
    : "";

  const status = quoteFilterStatus.value;

  return quotesStore.quotes.filter((quote) => {
    if (clientId && quote.clientId !== clientId) return false;
    if (filterDate && quote.quoteDate !== filterDate) return false;
    if (status && quote.status !== status) return false;
    if (!query) return true;

    const haystack = [
      quote.title,
      quote.quoteRef,
      quote.clientName,
      quote.clientAddress,
      quote.clientWebsite,
      getQuotePlatformLabel(quote.platform, quote.customPlatformLabel),
      quote.projectSummary,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

// Id du devis actuellement chargé (null = nouveau devis non encore enregistré).
// Ne jamais retomber sur un autre devis, sinon la sauvegarde écraserait celui-ci.
const quoteId = computed(() => quotesStore.selectedQuoteId);

const hydrateFromQuote = (quote: Quote | null) => {
  // Bloque les watchers de régénération le temps du chargement, puis relâche
  // après le flush des watchers (nextTick).
  hydratingQuote = true;
  void nextTick(() => {
    hydratingQuote = false;
  });

  if (!quote) {
    const explicitTemplate = quoteTemplatesStore.templates.find(
      (entry) => entry.id === selectedTemplateId.value,
    );
    if (explicitTemplate) {
      // Sélection explicite : on applique tout le template (portée projet comprise).
      Object.assign(form, createDraftFromTemplate(explicitTemplate));
    } else if (quoteTemplatesStore.defaultTemplate) {
      // Template par défaut : on applique le standard réutilisable (conditions,
      // principes, roadmap, options…) mais on laisse la partie projet vide.
      Object.assign(
        form,
        createDraftFromTemplate(quoteTemplatesStore.defaultTemplate),
        {
          parts: [createEmptyQuotePart()],
          projectSummary: "",
        },
      );
    } else {
      Object.assign(form, createDraft());
    }
    const nextEmailDraft = buildCurrentStandardEmail();
    form.emailSubject = nextEmailDraft.subject;
    form.emailBody = nextEmailDraft.body;
    form.emailDraft = composeLegacyEmailDraft(
      nextEmailDraft.subject,
      nextEmailDraft.body,
      form.language,
    );
    lastAutoEmailDraft.value = form.emailDraft;
    return;
  }

  const fallbackEmail = splitLegacyEmailDraft(quote.emailDraft || "");
  const emailSubject = quote.emailSubject || fallbackEmail.subject;
  const emailBody = quote.emailBody || fallbackEmail.body;

  Object.assign(form, {
    clientId: quote.clientId || "",
    title: quote.title || "",
    quoteDate: quote.quoteDate || getTodayQuoteDate(),
    quoteRef: quote.quoteRef,
    platform: quote.platform,
    customPlatformLabel: quote.customPlatformLabel || "",
    language: quote.language,
    clientName: quote.clientName,
    clientAddress: quote.clientAddress,
    clientWebsite: quote.clientWebsite,
    vatRate: quote.vatRate,
    projectSummary: quote.projectSummary,
    emailDraft: composeLegacyEmailDraft(
      emailSubject,
      emailBody,
      quote.language,
    ),
    emailSubject,
    emailBody,
    discountType: quote.discountType || "percent",
    discountValue: quote.discountValue || 0,
    version: quote.version || 1,
    versionGroupId: quote.versionGroupId || quote.id,
    parts: cloneQuoteParts(quote.parts),
    conditions: quote.conditions.map((condition) => ({
      ...condition,
      items: normalizeConditionItems(condition),
    })),
    roadmap: (quote.roadmap || []).map((phase) => ({
      ...phase,
      items: normalizeConditionItems(phase),
    })),
    acceptance: (quote.acceptance || []).map((entry) => ({
      ...entry,
      items: normalizeConditionItems(entry),
    })),
    principles: (quote.principles || []).map((principle) => ({
      ...principle,
      items: normalizeConditionItems(principle),
    })),
    addons: quote.addons.map((addon) => ({
      ...addon,
      unitLabel: addon.unitLabel || "",
      items: normalizeAddonItems(addon),
    })),
    status: quote.status,
  });
  lastAutoEmailDraft.value = form.emailDraft || "";
};

onMounted(async () => {
  syncCompactMode();
  window.addEventListener("resize", syncCompactMode);
  await Promise.all([
    quotesStore.fetchQuotes(),
    clientsStore.fetchClients(),
    quoteTemplatesStore.fetchTemplates(),
  ]);
  hydrateFromQuote(quotesStore.selectedQuote);
});

onUnmounted(() => {
  window.removeEventListener("resize", syncCompactMode);
  if (unsavedAttentionTimeout) clearTimeout(unsavedAttentionTimeout);
});

watch(isCompactQuotesView, (compact) => {
  if (!compact) mobileEditorVisible.value = false;
});

watch(
  () => quotesStore.selectedQuote,
  (quote) => hydrateFromQuote(quote),
);

watch(
  () =>
    [form.clientName, form.platform, form.language, form.quoteDate] as const,
  () => {
    if (hydratingQuote) return;
    form.quoteRef = generateQuoteReference(
      form.clientName,
      parseQuoteDate(form.quoteDate),
    );
  },
  { immediate: true },
);

watch(
  () => [form.language, form.clientName, form.title, form.quoteRef] as const,
  () => {
    if (hydratingQuote) return;
    const nextEmailDraft = buildCurrentStandardEmail();
    const nextLegacy = composeLegacyEmailDraft(
      nextEmailDraft.subject,
      nextEmailDraft.body,
      form.language,
    );
    if (!form.emailDraft || form.emailDraft === lastAutoEmailDraft.value) {
      form.emailSubject = nextEmailDraft.subject;
      form.emailBody = nextEmailDraft.body;
      form.emailDraft = nextLegacy;
    }
    lastAutoEmailDraft.value = nextLegacy;
  },
  { immediate: true },
);

watch(
  () => form.clientId,
  (clientId) => {
    if (hydratingQuote) return;
    const client = clientsStore.clients.find((entry) => entry.id === clientId);
    if (!client) {
      form.clientName = "";
      form.clientAddress = "";
      form.clientWebsite = "";
      form.vatRate = 21;
      form.conditions = createDefaultQuoteConditions(
        form.platform,
        form.language,
        "",
      );
      form.roadmap = createDefaultQuoteRoadmap(form.platform, form.language);
      form.acceptance = createDefaultQuoteAcceptance(form.language);
      form.principles = createDefaultQuotePrinciples(form.language);
      return;
    }
    form.clientName = formatClientFullName(client);
    form.clientAddress = formatClientAddress(client);
    form.clientWebsite = client.website || "";
    form.language = client.language;
    form.vatRate = computeVatRateForClient(client, authStore.userProfile);
    form.conditions = createDefaultQuoteConditions(
      form.platform,
      client.language,
      client.country,
    );
    form.roadmap = createDefaultQuoteRoadmap(form.platform, client.language);
    form.acceptance = createDefaultQuoteAcceptance(client.language);
    form.principles = createDefaultQuotePrinciples(client.language);
  },
);

watch(
  () => [form.platform, form.language] as const,
  ([platform, language], [oldPlatform, oldLanguage]) => {
    if (hydratingQuote) return;
    if (platform === oldPlatform && language === oldLanguage) return;
    if (platform !== "other") form.customPlatformLabel = "";
    form.conditions = createDefaultQuoteConditions(
      platform,
      language,
      selectedClient.value?.country || "",
    );
    form.roadmap = createDefaultQuoteRoadmap(platform, language);
    form.acceptance = createDefaultQuoteAcceptance(language);
    form.principles = createDefaultQuotePrinciples(language);
  },
);


const updateDiscountType = (value: QuoteDiscountType) => {
  form.discountType = value;
};

const updateDiscountValue = (value: number) => {
  form.discountValue = Math.max(Number(value || 0), 0);
};

const updateCondition = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === id);
  if (condition) condition[field] = value;
};

const moveCondition = (draggedId: string, targetId: string) => {
  const draggedIndex = form.conditions.findIndex(
    (condition) => condition.id === draggedId,
  );
  const targetIndex = form.conditions.findIndex(
    (condition) => condition.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.conditions];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.conditions = next;
};

const addConditionItem = (conditionId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = [
    ...(condition.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateConditionItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeConditionItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = condition.items.filter((entry) => entry.id !== itemId);
};

const moveConditionItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = condition.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...condition.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  condition.items = next;
};

const nestConditionItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetItem = condition.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = condition.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addConditionSubItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateConditionSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeConditionSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveConditionSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveConditionSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceItem = condition.items.find((entry) => entry.id === fromItemId);
  const targetItem = condition.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteConditionSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceIndex = condition.items.findIndex(
    (entry) => entry.id === fromItemId,
  );
  const targetIndex = condition.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = condition.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  condition.items.splice(targetIndex, 0, promoted);
};

const updateRoadmapPhase = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === id);
  if (phase) phase[field] = value;
};

const moveRoadmapPhase = (draggedId: string, targetId: string) => {
  const draggedIndex = form.roadmap.findIndex(
    (phase) => phase.id === draggedId,
  );
  const targetIndex = form.roadmap.findIndex((phase) => phase.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.roadmap];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.roadmap = next;
};

const addRoadmapItem = (phaseId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === phaseId);
  if (!phase) return;
  phase.items = [
    ...(phase.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateRoadmapItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeRoadmapItem = (conditionId: string, itemId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  phase.items = phase.items.filter((entry) => entry.id !== itemId);
};

const moveRoadmapItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const draggedIndex = phase.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = phase.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...phase.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  phase.items = next;
};

const nestRoadmapItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const draggedIndex = phase.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = phase.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = phase.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addRoadmapSubItem = (conditionId: string, itemId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveRoadmapSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const sourceItem = phase.items.find((entry) => entry.id === fromItemId);
  const targetItem = phase.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteRoadmapSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const sourceIndex = phase.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = phase.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = phase.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  phase.items.splice(targetIndex, 0, promoted);
};

const updateAcceptance = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === id);
  if (entry) entry[field] = value;
};

const moveAcceptance = (draggedId: string, targetId: string) => {
  const draggedIndex = form.acceptance.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = form.acceptance.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.acceptance];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.acceptance = next;
};

const addAcceptanceItem = (acceptanceId: string) => {
  const entry = form.acceptance.find((item) => item.id === acceptanceId);
  if (!entry) return;
  entry.items = [
    ...(entry.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateAcceptanceItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (item) item.text = value;
};

const removeAcceptanceItem = (conditionId: string, itemId: string) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  entry.items = entry.items.filter((row) => row.id !== itemId);
};

const moveAcceptanceItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const draggedIndex = entry.items.findIndex((row) => row.id === draggedId);
  const targetIndex = entry.items.findIndex((row) => row.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...entry.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  entry.items = next;
};

const nestAcceptanceItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const draggedIndex = entry.items.findIndex((row) => row.id === draggedId);
  const targetItem = entry.items.find((row) => row.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = entry.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addAcceptanceSubItem = (conditionId: string, itemId: string) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  const subItem = item?.subItems.find((row) => row.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((row) => row.id !== subItemId);
};

const moveAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex((row) => row.id === draggedId);
  const targetIndex = item.subItems.findIndex((row) => row.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveAcceptanceSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const sourceItem = entry.items.find((row) => row.id === fromItemId);
  const targetItem = entry.items.find((row) => row.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (row) => row.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteAcceptanceSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const sourceIndex = entry.items.findIndex((row) => row.id === fromItemId);
  const targetIndex = entry.items.findIndex((row) => row.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = entry.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex((row) => row.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  entry.items.splice(targetIndex, 0, promoted);
};

const updatePrinciple = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === id);
  if (principle) principle[field] = value;
};

const movePrinciple = (draggedId: string, targetId: string) => {
  const draggedIndex = form.principles.findIndex(
    (principle) => principle.id === draggedId,
  );
  const targetIndex = form.principles.findIndex(
    (principle) => principle.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.principles];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.principles = next;
};

const addPrincipleItem = (principleId: string) => {
  const principle = form.principles.find((entry) => entry.id === principleId);
  if (!principle) return;
  principle.items = [
    ...(principle.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updatePrincipleItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removePrincipleItem = (conditionId: string, itemId: string) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  principle.items = principle.items.filter((entry) => entry.id !== itemId);
};

const movePrincipleItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const draggedIndex = principle.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = principle.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...principle.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  principle.items = next;
};

const nestPrincipleItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const draggedIndex = principle.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetItem = principle.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = principle.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addPrincipleSubItem = (conditionId: string, itemId: string) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updatePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const movePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const movePrincipleSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const sourceItem = principle.items.find((entry) => entry.id === fromItemId);
  const targetItem = principle.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promotePrincipleSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const sourceIndex = principle.items.findIndex(
    (entry) => entry.id === fromItemId,
  );
  const targetIndex = principle.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = principle.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  principle.items.splice(targetIndex, 0, promoted);
};

const updateAddon = (
  id: string,
  field: "title" | "description" | "price" | "unitLabel",
  value: string | number,
) => {
  const addon = form.addons.find((entry) => entry.id === id);
  if (addon) (addon[field] as string | number) = value;
};

const addAddonItem = (addonId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  addon.items = [
    ...(addon.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateAddonItem = (addonId: string, itemId: string, value: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeAddonItem = (addonId: string, itemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  addon.items = addon.items.filter((entry) => entry.id !== itemId);
};

const moveAddonItem = (
  addonId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...addon.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  addon.items = next;
};

const nestAddonItemUnderItem = (
  addonId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = addon.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = addon.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addAddonSubItem = (addonId: string, itemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateAddonSubItem = (
  addonId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeAddonSubItem = (
  addonId: string,
  itemId: string,
  subItemId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveAddonSubItem = (
  addonId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveAddonSubItemToItem = (
  addonId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceItem = addon.items.find((entry) => entry.id === fromItemId);
  const targetItem = addon.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteAddonSubItemToItem = (
  addonId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceIndex = addon.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = addon.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  addon.items.splice(targetIndex, 0, promoted);
};

const addCondition = () => {
  form.conditions.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addRoadmapPhase = () => {
  form.roadmap.push({ id: createEntityId(), title: "", body: "", items: [] });
};

const addAcceptance = () => {
  form.acceptance.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addPrinciple = () => {
  form.principles.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addAddonPreset = () => {
  form.addons.push(createBlankAddon());
};

const duplicateAddon = (addonId: string) => {
  const source = form.addons.find((entry) => entry.id === addonId);
  if (!source) return;

  const duplicated: QuoteAddon = {
    ...source,
    id: createEntityId(),
    title: source.title?.trim() ? `${source.title} - copy` : "Add-on - copy",
    unitLabel: source.unitLabel || "",
    items: normalizeAddonItems(source).map((item) => ({
      id: createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: createEntityId(),
        text: subItem.text || "",
      })),
    })),
  };

  const sourceIndex = form.addons.findIndex((entry) => entry.id === addonId);
  form.addons.splice(sourceIndex + 1, 0, duplicated);
};

const moveAddon = (draggedId: string, targetId: string) => {
  const draggedIndex = form.addons.findIndex((addon) => addon.id === draggedId);
  const targetIndex = form.addons.findIndex((addon) => addon.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;

  const next = [...form.addons];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.addons = next;
};

const createNewVersion = async () => {
  const source = quotesStore.selectedQuote;
  if (!source) {
    toast.add({
      severity: "info",
      summary: "Sauvegarde requise",
      detail: "Sauvegarde le devis avant de créer une nouvelle version.",
      life: 3500,
    });
    return;
  }
  if (hasUnsavedChanges.value) {
    toast.add({
      severity: "warn",
      summary: "Modifications non sauvegardées",
      detail:
        "Sauvegarde tes changements avant de créer une nouvelle version.",
      life: 3500,
    });
    return;
  }

  const groupId = source.versionGroupId || source.id;
  const nextVersion =
    Math.max(
      source.version || 1,
      ...quotesStore.quotes
        .filter((quote) => (quote.versionGroupId || quote.id) === groupId)
        .map((quote) => quote.version || 1),
    ) + 1;

  const input = createQuoteVersionInput(source, nextVersion);
  const versionTotals = calculateQuotePartsTotals(
    input.parts,
    input.vatRate,
    input.discountType || "percent",
    input.discountValue || 0,
  );
  const created = await quotesStore.saveQuote(null, {
    ...input,
    subtotal: versionTotals.subtotal,
    totalWithVat: versionTotals.totalWithVat,
  });

  // L'ancienne version devient « Remplacé » (sauf décision finale du client).
  if (source.status !== "accepted" && source.status !== "refused") {
    await quotesStore.setQuoteStatus(source.id, "superseded");
  }

  hydrateFromQuote(created);
  if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  toast.add({
    severity: "success",
    summary: `Version ${nextVersion} créée`,
    detail:
      "Nouveau brouillon éditable — l'ancienne version est marquée « Remplacé ».",
    life: 3500,
  });
};

const duplicateCurrentQuote = () => {
  const id = quoteId.value;
  if (!id) {
    toast.add({
      severity: "info",
      summary: "Sauvegarde requise",
      detail: "Sauvegarde le devis avant de le dupliquer.",
      life: 3000,
    });
    return;
  }
  void duplicateQuote(id);
};

const duplicateQuote = async (id: string) => {
  if (hasUnsavedChanges.value) {
    notifyUnsavedBlockedAction();
    return;
  }
  const source = quotesStore.quotes.find((quote) => quote.id === id);
  if (!source) return;

  const payload = duplicateQuoteInput(source);
  const quoteTotals = calculateQuotePartsTotals(
    payload.parts,
    payload.vatRate,
    payload.discountType || "percent",
    payload.discountValue || 0,
  );
  const subtotal = quoteTotals.subtotal;
  const totalWithVat = quoteTotals.totalWithVat;

  await quotesStore.saveQuote(null, {
    ...payload,
    subtotal,
    totalWithVat,
  });
  if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  toast.add({
    severity: "success",
    summary: "Devis dupliqué",
    detail: "Un nouveau brouillon a été créé à partir du devis existant.",
    life: 2500,
  });
};

const applySelectedTemplate = (templateId?: string | null) => {
  const resolvedTemplateId = templateId ?? selectedTemplateId.value;
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === resolvedTemplateId,
  );
  if (!template) return;

  const nextDraft = createDraftFromTemplate(
    template,
    form.language || template.language,
  );
  const preserved = {
    clientId: form.clientId,
    clientName: form.clientName,
    clientAddress: form.clientAddress,
    clientWebsite: form.clientWebsite,
    quoteDate: form.quoteDate,
    quoteRef: form.quoteRef,
    title: form.title,
    vatRate: form.vatRate,
  };

  Object.assign(form, nextDraft, preserved);

  const nextEmailDraft = buildCurrentStandardEmail();
  form.emailSubject = nextEmailDraft.subject;
  form.emailBody = nextEmailDraft.body;
  form.emailDraft = composeLegacyEmailDraft(
    nextEmailDraft.subject,
    nextEmailDraft.body,
    form.language,
  );
  lastAutoEmailDraft.value = form.emailDraft;

  toast.add({
    severity: "secondary",
    summary: "Template appliqué",
    detail: `Le template ${template.name} a été appliqué au devis.`,
    life: 2200,
  });
};

const handleTemplateSelection = (value: string | null) => {
  selectedTemplateId.value = value;
  if (!value) return;
  applySelectedTemplate(value);
};

const saveQuote = async () => {
  form.emailDraft = composeLegacyEmailDraft(
    form.emailSubject,
    form.emailBody,
    form.language,
  );
  const payload: QuoteInput & Pick<Quote, "subtotal" | "totalWithVat"> = {
    ...form,
    subtotal: totals.value.subtotal,
    totalWithVat: totals.value.totalWithVat,
  };

  await quotesStore.saveQuote(quoteId.value, payload);
  toast.add({
    severity: "success",
    summary: "Devis sauvegardé",
    detail: "Le devis a été enregistré.",
    life: 2500,
  });
};

const downloadPdf = () => {
  const quote: Quote = {
    id: quoteId.value || createEntityId(),
    userId: "local",
    ...form,
    subtotal: totals.value.subtotal,
    totalWithVat: totals.value.totalWithVat,
    createdAt: new Date().toISOString(),
  };

  const opened = printQuoteDocument(quote, authStore.userProfile);
  if (!opened) {
    toast.add({
      severity: "warn",
      summary: "Fenêtre bloquée",
      detail:
        "Autorise les fenêtres pop-up pour ce site afin de générer le PDF.",
      life: 4000,
    });
    return;
  }
  toast.add({
    severity: "secondary",
    summary: "PDF prêt",
    detail:
      "Choisis « Enregistrer en PDF ». Astuce : décoche « En-têtes et pieds de page » dans les options d'impression pour un rendu net.",
    life: 5000,
  });
};

const deleteQuote = async () => {
  if (!quoteId.value) {
    hydrateFromQuote(null);
    return;
  }

  await quotesStore.deleteQuote(quoteId.value);
  hydrateFromQuote(quotesStore.selectedQuote);
  if (isCompactQuotesView.value) mobileEditorVisible.value = false;
  toast.add({
    severity: "secondary",
    summary: "Devis supprimé",
    detail: "Le brouillon a été retiré.",
    life: 2000,
  });
};

const copyEmailSubject = async () => {
  const success = await copyToClipboard(form.emailSubject);
  if (success) {
    toast.add({
      severity: "secondary",
      summary: "Objet copié",
      detail: "L’objet a été ajouté au presse-papiers.",
      life: 1800,
    });
  }
};

const copyEmailBody = async () => {
  const success = await copyToClipboard(form.emailBody);
  if (success) {
    toast.add({
      severity: "secondary",
      summary: "Contenu copié",
      detail: "Le contenu a été ajouté au presse-papiers.",
      life: 1800,
    });
  }
};

const handleCreateClientFromQuote = async (
  payload: ClientInput,
  id: string | null,
) => {
  const client = await clientsStore.saveClient(id, payload);
  clientDialogVisible.value = false;
  form.clientId = client.id;
  toast.add({
    severity: "success",
    summary: "Client créé",
    detail: "Le client est prêt pour le devis.",
    life: 2200,
  });
};

const updateQuoteDate = (value: Date | null) => {
  if (!value) return;
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  form.quoteDate = `${year}-${month}-${day}`;
};

const discardChanges = () => {
  hydrateFromQuote(quotesStore.selectedQuote);
  toast.add({
    severity: "secondary",
    summary: "Modifications annulées",
    detail: "Le devis a été réinitialisé.",
    life: 2200,
  });
};

const notifyUnsavedBlockedAction = () => {
  unsavedAttention.value = false;
  if (unsavedAttentionTimeout) clearTimeout(unsavedAttentionTimeout);
  void requestAnimationFrame(() => {
    unsavedAttention.value = true;
    unsavedAttentionTimeout = setTimeout(() => {
      unsavedAttention.value = false;
    }, 480);
  });
  toast.add({
    severity: "warn",
    summary: "Sauvegarde requise",
    detail: "Enregistre ou annule d’abord les modifications en cours.",
    life: 2200,
  });
};

const guardUnsavedViewChange = (action: () => void) => {
  if (hasUnsavedChanges.value) {
    notifyUnsavedBlockedAction();
    return;
  }
  action();
};

const openCreateQuote = () => {
  guardUnsavedViewChange(() => {
    quotesStore.selectQuote(null);
    hydrateFromQuote(null);
    if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  });
};

const openQuote = (id: string) => {
  guardUnsavedViewChange(() => {
    quotesStore.selectQuote(id);
    if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  });
};

const closeMobileEditor = () => {
  guardUnsavedViewChange(() => {
    mobileEditorVisible.value = false;
  });
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      class="sticky top-0 z-20 bg-surface-light/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-surface-light/80"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Devis</h1>

        <div
          v-if="hasUnsavedChanges"
          class="hidden lg:flex items-center gap-2 rounded-full border border-surface-dark/10 bg-white/95 px-3 py-2 shadow-sm"
          :class="{ 'quotes-unsaved-nudge': unsavedAttention }"
        >
          <div class="flex items-center gap-2 min-w-0 pr-1">
            <span
              class="material-symbols-outlined text-base text-surface-dark/60"
              >pending_actions</span
            >
            <span class="truncate text-sm font-medium text-surface-dark/75"
              >Unsaved changes</span
            >
          </div>
          <Button severity="secondary" size="small" @click="discardChanges"
            >Discard</Button
          >
          <Button size="small" @click="saveQuote">Save</Button>
        </div>
      </div>
    </div>

    <div class="lg:hidden">
      <QuoteTablePanel
        :quotes="filteredQuotes"
        :clients="clientsStore.clients"
        :search="quoteSearch"
        :filter-client-id="quoteFilterClientId"
        :filter-date="quoteFilterDate"
        :filter-status="quoteFilterStatus"
        @create="openCreateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date="quoteFilterDate = $event"
        @update:filter-status="quoteFilterStatus = $event"
      />
    </div>

    <div
      class="hidden lg:grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start"
    >
      <QuoteListPanel
        :quotes="filteredQuotes"
        :selected-quote-id="quoteId"
        :clients="clientsStore.clients"
        :search="quoteSearch"
        :filter-client-id="quoteFilterClientId"
        :filter-date="quoteFilterDate"
        :filter-status="quoteFilterStatus"
        @create="openCreateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date="quoteFilterDate = $event"
        @update:filter-status="quoteFilterStatus = $event"
      />

      <div class="flex flex-col gap-6">
        <QuoteActionBar
          :can-manage="Boolean(quoteId)"
          @save="saveQuote"
          @download-pdf="downloadPdf"
          @duplicate="duplicateCurrentQuote"
          @delete="deleteQuote"
        />

        <div class="rounded-3xl border border-surface-dark/5 bg-white p-4">
          <div
            class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
          >
            <label class="flex flex-col gap-2">
              <span class="text-sm font-semibold text-surface-dark"
                >Template de départ</span
              >
              <Select
                v-model="selectedTemplateId"
                @update:model-value="handleTemplateSelection"
                :options="templateOptions"
                option-label="label"
                option-value="value"
                placeholder="Choisir un template"
                show-clear
              />
            </label>
            <Button
              text
              severity="secondary"
              @click="$router.push('/quote-templates')"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >open_in_new</span
                ></template
              >
              Gérer les templates
            </Button>
          </div>
          <p class="mt-3 flex flex-wrap items-center gap-1 text-xs text-surface-dark/55">
            <template v-if="defaultTemplateName">
              <span class="material-symbols-outlined text-sm text-amber-500">star</span>
              Base par défaut :
              <strong class="text-surface-dark/75">{{ defaultTemplateName }}</strong> — conditions, roadmap et options des nouveaux devis.
              <button type="button" class="font-medium text-primary hover:underline" @click="editDefaultBase">
                Modifier la base
              </button>
            </template>
            <template v-else>
              Les nouveaux devis utilisent un contenu de base intégré.
              <button type="button" class="font-medium text-primary hover:underline" @click="editDefaultBase">
                Créer une base modifiable
              </button>
            </template>
          </p>
        </div>

        <QuoteBuilderForm
          :quote-ref="form.quoteRef"
          :title="form.title"
          :quote-date="quoteDateModel"
          :valid-until="validUntil"
          :client-id="form.clientId"
          :client-name="form.clientName"
          :client-address="form.clientAddress"
          :client-website="form.clientWebsite"
          :client-country="selectedClient?.country || ''"
          :client-vat-label="
            selectedClient
              ? selectedClient.isVatRegistered
                ? selectedClient.vatNumber || 'Client assujetti à la TVA'
                : 'Client non assujetti à la TVA'
              : 'Aucun client sélectionné'
          "
          :platform="form.platform"
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :vat-rate="form.vatRate"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          :parts="form.parts"
          :currency-locale="currencyLocale"
          :status="form.status"
          :version="form.version"
          :conditions="form.conditions"
          :roadmap="form.roadmap"
          :acceptance="form.acceptance"
          :principles="form.principles"
          :addons="form.addons"
          :clients="clientsStore.clients"
          :addons-total="totals.addonsTotal"
          :discount-amount="totals.discountAmount"
          :subtotal="totals.subtotal"
          :vat-amount="totals.vatAmount"
          :total-with-vat="totals.totalWithVat"
          :vat-explanation="vatExplanation"
          @update:title="form.title = $event"
          @update:quote-date="updateQuoteDate"
          @update:client-id="form.clientId = $event"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="updateDiscountType"
          @update:discount-value="updateDiscountValue"
          @update:project-summary="form.projectSummary = $event"
          @update:parts="form.parts = $event"
          @update:status="form.status = $event"
          @new-version="createNewVersion"
          @create-client="clientDialogVisible = true"
          @add-condition="addCondition"
          @move-condition="moveCondition($event.draggedId, $event.targetId)"
          @update-condition="
            updateCondition($event.id, $event.field, $event.value)
          "
          @remove-condition="
            form.conditions = form.conditions.filter(
              (condition) => condition.id !== $event,
            )
          "
          @add-condition-item="addConditionItem"
          @update-condition-item="
            updateConditionItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-condition-item="
            removeConditionItem($event.conditionId, $event.itemId)
          "
          @move-condition-item="
            moveConditionItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-condition-item-under-item="
            nestConditionItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-condition-sub-item="
            addConditionSubItem($event.conditionId, $event.itemId)
          "
          @update-condition-sub-item="
            updateConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-condition-sub-item="
            removeConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-condition-sub-item="
            moveConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-condition-sub-item-to-item="
            moveConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-condition-sub-item-to-item="
            promoteConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-roadmap-phase="addRoadmapPhase"
          @move-roadmap-phase="
            moveRoadmapPhase($event.draggedId, $event.targetId)
          "
          @update-roadmap-phase="
            updateRoadmapPhase($event.id, $event.field, $event.value)
          "
          @remove-roadmap-phase="
            form.roadmap = form.roadmap.filter((phase) => phase.id !== $event)
          "
          @add-roadmap-item="addRoadmapItem"
          @update-roadmap-item="
            updateRoadmapItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-roadmap-item="
            removeRoadmapItem($event.conditionId, $event.itemId)
          "
          @move-roadmap-item="
            moveRoadmapItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-roadmap-item-under-item="
            nestRoadmapItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-roadmap-sub-item="
            addRoadmapSubItem($event.conditionId, $event.itemId)
          "
          @update-roadmap-sub-item="
            updateRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-roadmap-sub-item="
            removeRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-roadmap-sub-item="
            moveRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-roadmap-sub-item-to-item="
            moveRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-roadmap-sub-item-to-item="
            promoteRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-acceptance="addAcceptance"
          @move-acceptance="moveAcceptance($event.draggedId, $event.targetId)"
          @update-acceptance="
            updateAcceptance($event.id, $event.field, $event.value)
          "
          @remove-acceptance="
            form.acceptance = form.acceptance.filter(
              (entry) => entry.id !== $event,
            )
          "
          @add-acceptance-item="addAcceptanceItem"
          @update-acceptance-item="
            updateAcceptanceItem(
              $event.conditionId,
              $event.itemId,
              $event.value,
            )
          "
          @remove-acceptance-item="
            removeAcceptanceItem($event.conditionId, $event.itemId)
          "
          @move-acceptance-item="
            moveAcceptanceItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-acceptance-item-under-item="
            nestAcceptanceItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-acceptance-sub-item="
            addAcceptanceSubItem($event.conditionId, $event.itemId)
          "
          @update-acceptance-sub-item="
            updateAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-acceptance-sub-item="
            removeAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-acceptance-sub-item="
            moveAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-acceptance-sub-item-to-item="
            moveAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-acceptance-sub-item-to-item="
            promoteAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-principle="addPrinciple"
          @move-principle="movePrinciple($event.draggedId, $event.targetId)"
          @update-principle="
            updatePrinciple($event.id, $event.field, $event.value)
          "
          @remove-principle="
            form.principles = form.principles.filter(
              (principle) => principle.id !== $event,
            )
          "
          @add-principle-item="addPrincipleItem"
          @update-principle-item="
            updatePrincipleItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-principle-item="
            removePrincipleItem($event.conditionId, $event.itemId)
          "
          @move-principle-item="
            movePrincipleItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-principle-item-under-item="
            nestPrincipleItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-principle-sub-item="
            addPrincipleSubItem($event.conditionId, $event.itemId)
          "
          @update-principle-sub-item="
            updatePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-principle-sub-item="
            removePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-principle-sub-item="
            movePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-principle-sub-item-to-item="
            movePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-principle-sub-item-to-item="
            promotePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-addon-preset="addAddonPreset"
          @duplicate-addon="duplicateAddon"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="
            form.addons = form.addons.filter((addon) => addon.id !== $event)
          "
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @add-addon-item="addAddonItem"
          @update-addon-item="
            updateAddonItem($event.addonId, $event.itemId, $event.value)
          "
          @remove-addon-item="removeAddonItem($event.addonId, $event.itemId)"
          @move-addon-item="
            moveAddonItem($event.addonId, $event.draggedId, $event.targetId)
          "
          @nest-addon-item-under-item="
            nestAddonItemUnderItem(
              $event.addonId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-addon-sub-item="addAddonSubItem($event.addonId, $event.itemId)"
          @update-addon-sub-item="
            updateAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-addon-sub-item="
            removeAddonSubItem($event.addonId, $event.itemId, $event.subItemId)
          "
          @move-addon-sub-item="
            moveAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-addon-sub-item-to-item="
            moveAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-addon-sub-item-to-item="
            promoteAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
        />

        <QuoteOutputPanel
          :language="form.language"
          :email-subject="form.emailSubject"
          :email-body="form.emailBody"
          @update:email-subject="
            form.emailSubject = $event;
            form.emailDraft = composeLegacyEmailDraft(
              form.emailSubject,
              form.emailBody,
              form.language,
            );
          "
          @update:email-body="
            form.emailBody = $event;
            form.emailDraft = composeLegacyEmailDraft(
              form.emailSubject,
              form.emailBody,
              form.language,
            );
          "
          @copy-email-subject="copyEmailSubject"
          @copy-email-body="copyEmailBody"
        />
      </div>
    </div>

    <Dialog
      v-model:visible="mobileEditorVisible"
      modal
      :draggable="false"
      :dismissable-mask="!hasUnsavedChanges"
      class="lg:!hidden"
      :style="{ width: '100vw', maxWidth: '100vw', height: '100vh' }"
      :pt="{
        root: { class: '!m-0 !rounded-none' },
        header: { class: '!hidden' },
        content: { class: '!h-full !overflow-y-auto !bg-surface-light !p-0' },
      }"
    >
      <div class="flex min-h-full flex-col gap-4 p-4">
        <div
          class="sticky top-0 z-10 flex flex-col gap-3 border-b border-surface-dark/8 bg-surface-light/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-light/80"
        >
          <div class="flex items-center justify-between gap-3">
            <Button text severity="secondary" @click="closeMobileEditor">
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >arrow_back</span
                ></template
              >
              Retour à la liste
            </Button>
            <p class="min-w-0 truncate text-sm font-semibold text-surface-dark">
              {{ form.title || form.clientName || "Nouveau devis" }}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button text severity="secondary" size="small" class="!rounded-xl" @click="duplicateCurrentQuote">
              <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
              Dupliquer
            </Button>
            <Button text severity="danger" size="small" class="!rounded-xl" @click="deleteQuote">
              <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
            </Button>
            <Button severity="secondary" outlined size="small" class="!rounded-xl" @click="downloadPdf">
              <template #icon><span class="material-symbols-outlined text-lg">download</span></template>
              PDF
            </Button>
            <Button size="small" class="!rounded-xl !px-4 font-semibold" @click="saveQuote">
              <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
              Sauvegarder
            </Button>
          </div>
          <div
            v-if="hasUnsavedChanges"
            class="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-surface-dark/10 bg-white px-3 py-2 shadow-sm"
            :class="{ 'quotes-unsaved-nudge': unsavedAttention }"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="material-symbols-outlined text-base text-surface-dark/60"
                >pending_actions</span
              >
              <span class="truncate text-sm font-medium text-surface-dark/75"
                >Unsaved changes</span
              >
            </div>
            <div class="flex items-center gap-2">
              <Button severity="secondary" size="small" @click="discardChanges"
                >Discard</Button
              >
              <Button size="small" @click="saveQuote">Save</Button>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-white p-4">
          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-2">
              <span class="text-sm font-semibold text-surface-dark"
                >Template de départ</span
              >
              <Select
                v-model="selectedTemplateId"
                @update:model-value="handleTemplateSelection"
                :options="templateOptions"
                option-label="label"
                option-value="value"
                placeholder="Choisir un template"
                show-clear
              />
            </label>
            <Button
              text
              severity="secondary"
              @click="$router.push('/quote-templates')"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >open_in_new</span
                ></template
              >
              Gérer les templates
            </Button>
          </div>
          <p class="mt-3 flex flex-wrap items-center gap-1 text-xs text-surface-dark/55">
            <template v-if="defaultTemplateName">
              <span class="material-symbols-outlined text-sm text-amber-500">star</span>
              Base par défaut :
              <strong class="text-surface-dark/75">{{ defaultTemplateName }}</strong> — conditions, roadmap et options des nouveaux devis.
              <button type="button" class="font-medium text-primary hover:underline" @click="editDefaultBase">
                Modifier la base
              </button>
            </template>
            <template v-else>
              Les nouveaux devis utilisent un contenu de base intégré.
              <button type="button" class="font-medium text-primary hover:underline" @click="editDefaultBase">
                Créer une base modifiable
              </button>
            </template>
          </p>
        </div>

        <QuoteBuilderForm
          :quote-ref="form.quoteRef"
          :title="form.title"
          :quote-date="quoteDateModel"
          :valid-until="validUntil"
          :client-id="form.clientId"
          :client-name="form.clientName"
          :client-address="form.clientAddress"
          :client-website="form.clientWebsite"
          :client-country="selectedClient?.country || ''"
          :client-vat-label="
            selectedClient
              ? selectedClient.isVatRegistered
                ? selectedClient.vatNumber || 'Client assujetti à la TVA'
                : 'Client non assujetti à la TVA'
              : 'Aucun client sélectionné'
          "
          :platform="form.platform"
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :vat-rate="form.vatRate"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          :parts="form.parts"
          :currency-locale="currencyLocale"
          :status="form.status"
          :version="form.version"
          :conditions="form.conditions"
          :roadmap="form.roadmap"
          :acceptance="form.acceptance"
          :principles="form.principles"
          :addons="form.addons"
          :clients="clientsStore.clients"
          :addons-total="totals.addonsTotal"
          :discount-amount="totals.discountAmount"
          :subtotal="totals.subtotal"
          :vat-amount="totals.vatAmount"
          :total-with-vat="totals.totalWithVat"
          :vat-explanation="vatExplanation"
          @update:title="form.title = $event"
          @update:quote-date="updateQuoteDate"
          @update:client-id="form.clientId = $event"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="updateDiscountType"
          @update:discount-value="updateDiscountValue"
          @update:project-summary="form.projectSummary = $event"
          @update:parts="form.parts = $event"
          @update:status="form.status = $event"
          @new-version="createNewVersion"
          @create-client="clientDialogVisible = true"
          @add-condition="addCondition"
          @move-condition="moveCondition($event.draggedId, $event.targetId)"
          @update-condition="
            updateCondition($event.id, $event.field, $event.value)
          "
          @remove-condition="
            form.conditions = form.conditions.filter(
              (condition) => condition.id !== $event,
            )
          "
          @add-condition-item="addConditionItem"
          @update-condition-item="
            updateConditionItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-condition-item="
            removeConditionItem($event.conditionId, $event.itemId)
          "
          @move-condition-item="
            moveConditionItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-condition-item-under-item="
            nestConditionItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-condition-sub-item="
            addConditionSubItem($event.conditionId, $event.itemId)
          "
          @update-condition-sub-item="
            updateConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-condition-sub-item="
            removeConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-condition-sub-item="
            moveConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-condition-sub-item-to-item="
            moveConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-condition-sub-item-to-item="
            promoteConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-roadmap-phase="addRoadmapPhase"
          @move-roadmap-phase="
            moveRoadmapPhase($event.draggedId, $event.targetId)
          "
          @update-roadmap-phase="
            updateRoadmapPhase($event.id, $event.field, $event.value)
          "
          @remove-roadmap-phase="
            form.roadmap = form.roadmap.filter((phase) => phase.id !== $event)
          "
          @add-roadmap-item="addRoadmapItem"
          @update-roadmap-item="
            updateRoadmapItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-roadmap-item="
            removeRoadmapItem($event.conditionId, $event.itemId)
          "
          @move-roadmap-item="
            moveRoadmapItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-roadmap-item-under-item="
            nestRoadmapItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-roadmap-sub-item="
            addRoadmapSubItem($event.conditionId, $event.itemId)
          "
          @update-roadmap-sub-item="
            updateRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-roadmap-sub-item="
            removeRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-roadmap-sub-item="
            moveRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-roadmap-sub-item-to-item="
            moveRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-roadmap-sub-item-to-item="
            promoteRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-acceptance="addAcceptance"
          @move-acceptance="moveAcceptance($event.draggedId, $event.targetId)"
          @update-acceptance="
            updateAcceptance($event.id, $event.field, $event.value)
          "
          @remove-acceptance="
            form.acceptance = form.acceptance.filter(
              (entry) => entry.id !== $event,
            )
          "
          @add-acceptance-item="addAcceptanceItem"
          @update-acceptance-item="
            updateAcceptanceItem(
              $event.conditionId,
              $event.itemId,
              $event.value,
            )
          "
          @remove-acceptance-item="
            removeAcceptanceItem($event.conditionId, $event.itemId)
          "
          @move-acceptance-item="
            moveAcceptanceItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-acceptance-item-under-item="
            nestAcceptanceItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-acceptance-sub-item="
            addAcceptanceSubItem($event.conditionId, $event.itemId)
          "
          @update-acceptance-sub-item="
            updateAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-acceptance-sub-item="
            removeAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-acceptance-sub-item="
            moveAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-acceptance-sub-item-to-item="
            moveAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-acceptance-sub-item-to-item="
            promoteAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-principle="addPrinciple"
          @move-principle="movePrinciple($event.draggedId, $event.targetId)"
          @update-principle="
            updatePrinciple($event.id, $event.field, $event.value)
          "
          @remove-principle="
            form.principles = form.principles.filter(
              (principle) => principle.id !== $event,
            )
          "
          @add-principle-item="addPrincipleItem"
          @update-principle-item="
            updatePrincipleItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-principle-item="
            removePrincipleItem($event.conditionId, $event.itemId)
          "
          @move-principle-item="
            movePrincipleItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-principle-item-under-item="
            nestPrincipleItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-principle-sub-item="
            addPrincipleSubItem($event.conditionId, $event.itemId)
          "
          @update-principle-sub-item="
            updatePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-principle-sub-item="
            removePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-principle-sub-item="
            movePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-principle-sub-item-to-item="
            movePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-principle-sub-item-to-item="
            promotePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-addon-preset="addAddonPreset"
          @duplicate-addon="duplicateAddon"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="
            form.addons = form.addons.filter((addon) => addon.id !== $event)
          "
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @add-addon-item="addAddonItem"
          @update-addon-item="
            updateAddonItem($event.addonId, $event.itemId, $event.value)
          "
          @remove-addon-item="removeAddonItem($event.addonId, $event.itemId)"
          @move-addon-item="
            moveAddonItem($event.addonId, $event.draggedId, $event.targetId)
          "
          @nest-addon-item-under-item="
            nestAddonItemUnderItem(
              $event.addonId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-addon-sub-item="addAddonSubItem($event.addonId, $event.itemId)"
          @update-addon-sub-item="
            updateAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-addon-sub-item="
            removeAddonSubItem($event.addonId, $event.itemId, $event.subItemId)
          "
          @move-addon-sub-item="
            moveAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-addon-sub-item-to-item="
            moveAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-addon-sub-item-to-item="
            promoteAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
        />

        <QuoteOutputPanel
          :language="form.language"
          :email-subject="form.emailSubject"
          :email-body="form.emailBody"
          @update:email-subject="
            form.emailSubject = $event;
            form.emailDraft = composeLegacyEmailDraft(
              form.emailSubject,
              form.emailBody,
              form.language,
            );
          "
          @update:email-body="
            form.emailBody = $event;
            form.emailDraft = composeLegacyEmailDraft(
              form.emailSubject,
              form.emailBody,
              form.language,
            );
          "
          @copy-email-subject="copyEmailSubject"
          @copy-email-body="copyEmailBody"
        />
      </div>
    </Dialog>

    <ClientFormDialog
      v-model:visible="clientDialogVisible"
      :client="null"
      @save="handleCreateClientFromQuote"
    />
  </div>
</template>

<style scoped>
@keyframes quotes-unsaved-nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-5px);
  }
  40% {
    transform: translateX(5px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
}

.quotes-unsaved-nudge {
  animation: quotes-unsaved-nudge 0.46s ease-in-out;
}
</style>
