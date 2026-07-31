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
  Client,
  ClientInput,
  Quote,
  QuoteAddon,
  QuoteCondition,
  QuoteConditionItem,
  QuoteConditionSubItem,
  QuoteDiscountType,
  QuoteInput,
  QuoteLanguage,
  QuotePaymentScheduleStep,
  QuoteStatus,
  QuoteTemplate,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import ConfirmDialog from "primevue/confirmdialog";
import Dialog from "primevue/dialog";
import Menu from "primevue/menu";
import Select from "primevue/select";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ClientFormDialog from "@/components/clients/ClientFormDialog.vue";
import QuoteBuilderForm from "@/components/quotes/QuoteBuilderForm.vue";
import QuoteOutputPanel from "@/components/quotes/QuoteOutputPanel.vue";
import {
  createBlankAddon,
  createDefaultPaymentSchedule,
  createDefaultQuoteAcceptance,
  createDefaultQuotePrinciples,
  getEstimatedTimelineTitle,
  quoteEmailPresets,
  quoteStatusMeta,
} from "@/lib/clientPresets";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { formatClientAddress, formatClientFullName } from "@/utils/address";
import { copyToClipboard } from "@/utils/clipboard";
import { formatDateTime } from "@/utils/date";
import { hydrateBlocks, serializeBlocks } from "@/utils/quoteBlocks";
import { renderQuoteDocumentHtml } from "@/utils/quotePdf";
import {
  calculateAddonTotal,
  calculateQuotePartsTotals,
  cloneInvestmentLines,
  clonePaymentSchedule,
  cloneQuoteParts,
  createEmptyQuotePart,
  createEntityId,
  createQuoteVersionInput,
  duplicateQuoteInput,
  formatCurrency,
  formatQuoteDate,
  generateQuoteReference,
  getQuotePlatformLabel,
  getQuoteValidityDate,
  getTodayQuoteDate,
  parseQuoteDate,
} from "@/utils/quote";
import { buildQuoteList, readQuoteListQuery } from "@/utils/quoteFilters";
import { resolveCommonConditionReferences as resolveSharedCommonConditionReferences } from "@/utils/quoteTemplateDraft";
import { computeVatRateForClient, getVatExplanation } from "@/utils/vat";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";

type QuoteDraft = QuoteInput;

const route = useRoute();
const router = useRouter();
const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quoteTemplatesStore = useQuoteTemplatesStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const clientDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const previewFrame = ref<HTMLIFrameElement | null>(null);
const previewScrollPosition = ref({ left: 0, top: 0 });
const shouldRestorePreviewScroll = ref(false);
const selectedTemplateId = ref<string | null>("");
const lastAutoEmailDraft = ref("");
const lastAutoEmailSubject = ref("");
const lastAutoEmailBody = ref("");
const unsavedAttention = ref(false);
// Empêche les watchers de régénérer le contenu par défaut pendant le chargement
// d'un devis (sinon le formulaire diffère toujours de la référence → faux « modifié »).
let hydratingQuote = false;

let unsavedAttentionTimeout: ReturnType<typeof setTimeout> | null = null;

// Brouillon vierge : le contenu de stack (conditions, roadmap, add-ons…) vient
// d'un template ; le mail, la validation et les principes viennent de la base commune.
// Les conditions communes sont référencées par les templates pour rester ordonnables.
const createDraft = (): QuoteDraft => ({
  clientId: "",
  projectId: "",
  templateId: "",
  title: "",
  projectName: "",
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
  investmentSummary: "",
  investmentAmount: 0,
  investmentLines: [],
  emailDraft: "",
  emailSubject: "",
  emailBody: "",
  discountType: "percent",
  discountValue: 0,
  version: 1,
  versionGroupId: createEntityId(),
  parts: [],
  conditions: [],
  roadmap: [],
  acceptance: [],
  principles: [],
  addons: [],
  paymentSchedule: createDefaultPaymentSchedule("fr"),
  status: "draft",
});

const cloneDraft = (draft: QuoteDraft): QuoteDraft =>
  JSON.parse(JSON.stringify(draft)) as QuoteDraft;

const cloneTemplateLocalizedSlice = (
  slice?: Partial<QuoteTemplateLocalizedContent> | null,
): QuoteTemplateLocalizedContent => ({
  projectSummary: slice?.projectSummary || "",
  emailSubject: slice?.emailSubject || "",
  emailBody: slice?.emailBody || "",
  parts: (slice?.parts || []).map((part) => ({
    ...part,
    id: part.id || createEntityId(),
    sections: (part.sections || []).map((section) => ({
      ...section,
      id: section.id || createEntityId(),
      blocks: hydrateBlocks(section.blocks || []),
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
  paymentSchedule: clonePaymentSchedule(slice?.paymentSchedule || []),
});

const resolveTemplateContent = (
  template: QuoteTemplate,
  language: QuoteLanguage,
): QuoteTemplateLocalizedContent => {
  const localizedSlice = template.localizedContent?.[language];
  if (localizedSlice) {
    const content = cloneTemplateLocalizedSlice(localizedSlice);
    if (!content.paymentSchedule.length && template.paymentSchedule?.length) {
      content.paymentSchedule = clonePaymentSchedule(template.paymentSchedule);
    }
    return content;
  }

  return cloneTemplateLocalizedSlice({
    projectSummary: template.projectSummary || "",
    parts: template.parts,
    conditions: template.conditions,
    roadmap: template.roadmap,
    acceptance: template.acceptance,
    principles: template.principles,
    addons: template.addons,
    paymentSchedule: template.paymentSchedule,
  });
};

const normalizeStoredMailTemplate = (
  value: string | undefined,
  preset: string,
): string => {
  const normalizedValue = (value || "").trim().replace(/\r\n/g, "\n");
  const normalizedPreset = preset.trim().replace(/\r\n/g, "\n");
  return normalizedValue === normalizedPreset ? "" : normalizedValue;
};

/**
 * Contenu commun issu de la base commune (mail d'envoi, validation &
 * principes), dans la langue demandée. Le mail reste vide tant qu'il n'a pas
 * été explicitement encodé.
 */
const getBaseCommonContent = (
  language: QuoteLanguage,
): Pick<QuoteDraft, "emailSubject" | "emailBody" | "acceptance" | "principles" | "paymentSchedule"> => {
  const base = quoteTemplatesStore.baseTemplate;
  if (!base) {
    return {
      emailSubject: "",
      emailBody: "",
      acceptance: createDefaultQuoteAcceptance(language),
      principles: createDefaultQuotePrinciples(language),
      paymentSchedule: createDefaultPaymentSchedule(language),
    };
  }
  const content = resolveTemplateContent(base, language);
  return {
    emailSubject: normalizeStoredMailTemplate(
      content.emailSubject,
      quoteEmailPresets[language].subject,
    ),
    emailBody: normalizeStoredMailTemplate(
      content.emailBody,
      quoteEmailPresets[language].body,
    ),
    acceptance: content.acceptance,
    principles: content.principles,
    paymentSchedule: content.paymentSchedule?.length
      ? clonePaymentSchedule(content.paymentSchedule)
      : createDefaultPaymentSchedule(language),
  };
};

const getBaseCommonConditions = (language: QuoteLanguage): QuoteCondition[] => {
  const base = quoteTemplatesStore.baseTemplate;
  if (!base) return [];
  return resolveTemplateContent(base, language).conditions;
};

const resolveCommonConditionReferences = (
  conditions: QuoteCondition[] = [],
  language: QuoteLanguage,
): QuoteCondition[] => {
  return resolveSharedCommonConditionReferences(
    conditions,
    getBaseCommonConditions(language),
  );
};

const normalizePaymentScheduleForComparison = (
  steps: QuotePaymentScheduleStep[] = [],
) =>
  steps.map((step) => ({
    label: (step.label || "").trim().toLowerCase(),
    mode: step.mode || "percent",
    value: Number(step.value || 0),
  }));

const isDefaultPaymentSchedule = (
  steps: QuotePaymentScheduleStep[] = [],
  language: QuoteLanguage,
) => {
  if (!steps.length) return true;
  const current = normalizePaymentScheduleForComparison(steps);
  const defaults = normalizePaymentScheduleForComparison(
    createDefaultPaymentSchedule(language),
  );
  return JSON.stringify(current) === JSON.stringify(defaults);
};

const resolveQuotePaymentSchedule = (
  quote: Pick<Quote, "language" | "paymentSchedule">,
) => {
  const quoteSchedule = clonePaymentSchedule(quote.paymentSchedule || []);
  if (isDefaultPaymentSchedule(quoteSchedule, quote.language)) {
    return getBaseCommonContent(quote.language).paymentSchedule;
  }
  return quoteSchedule;
};

const createDraftFromTemplate = (
  template: QuoteTemplate,
  languageOverride?: QuoteLanguage,
): QuoteDraft => {
  const targetLanguage = languageOverride || template.language;
  const localizedContent = resolveTemplateContent(template, targetLanguage);

  return {
    clientId: "",
    templateId: template.id,
    title: "",
    projectName: "",
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
    investmentSummary: "",
    investmentAmount: 0,
    investmentLines: [],
    emailDraft: "",
    emailSubject: "",
    emailBody: "",
    discountType: template.discountType || "percent",
    discountValue: template.discountValue || 0,
    version: 1,
    versionGroupId: createEntityId(),
    parts: cloneQuoteParts(localizedContent.parts),
    conditions: resolveCommonConditionReferences(
      localizedContent.conditions,
      targetLanguage,
    ),
    roadmap: localizedContent.roadmap,
    acceptance: localizedContent.acceptance,
    principles: localizedContent.principles,
    addons: localizedContent.addons,
    paymentSchedule: clonePaymentSchedule(localizedContent.paymentSchedule),
    status: "draft",
  };
};

const buildStandardQuoteEmail = (payload: {
  language: QuoteLanguage;
  clientName: string;
  clientFirstName?: string;
  title: string;
  projectName: string;
  quoteRef: string;
  hourlyRate?: number;
  subjectTemplate?: string;
  bodyTemplate?: string;
}): { subject: string; body: string } => {
  const clientFirstName =
    payload.clientFirstName?.trim() ||
    payload.clientName.trim().split(/\s+/)[0] ||
    "";
  const replacements: Record<string, string> = {
    client: clientFirstName,
    titre: payload.title || "",
    projet: payload.projectName || "",
    ref: payload.quoteRef || "",
    taux_horaire: payload.hourlyRate
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(payload.hourlyRate)
      : "",
    taux_journalier: payload.hourlyRate
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(payload.hourlyRate * 8)
      : "",
  };
  const renderTemplate = (template: string) =>
    template.replace(
      /\{(client|titre|projet|ref|taux_horaire|taux_journalier)\}/g,
      (_match, key: string) => replacements[key] || "",
    );

  const hasTemplate =
    payload.subjectTemplate !== undefined || payload.bodyTemplate !== undefined;
  const baseSubject = payload.subjectTemplate ?? quoteEmailPresets[payload.language].subject;
  const baseBody = payload.bodyTemplate ?? quoteEmailPresets[payload.language].body;

  if (hasTemplate) {
    return {
      subject: renderTemplate(baseSubject),
      body: renderTemplate(baseBody),
    };
  }

  const clientGreeting = clientFirstName;
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
const newQuoteBaseline = ref<QuoteDraft>(cloneDraft(createDraft()));

const resolveClientFirstName = (clientId: string, fallbackName: string): string => {
  const client = clientsStore.clients.find((entry) => entry.id === clientId);
  return client?.firstName?.trim() || fallbackName.trim().split(/\s+/)[0] || "";
};

const buildCurrentStandardEmail = (): { subject: string; body: string } =>
  {
    const baseContent = getBaseCommonContent(form.language);
    return buildStandardQuoteEmail({
      language: form.language,
      clientName: form.clientName,
      clientFirstName: resolveClientFirstName(form.clientId, form.clientName),
      title: form.title,
      projectName: form.projectName || "",
      quoteRef: form.quoteRef,
      hourlyRate: Number(authStore.userProfile?.hourlyRate || 0),
      subjectTemplate: baseContent.emailSubject,
      bodyTemplate: baseContent.emailBody,
    });
  };

const renderedEmail = computed(() =>
  buildStandardQuoteEmail({
    language: form.language,
    clientName: form.clientName,
    clientFirstName: resolveClientFirstName(form.clientId, form.clientName),
    title: form.title,
    projectName: form.projectName || "",
    quoteRef: form.quoteRef,
    hourlyRate: Number(authStore.userProfile?.hourlyRate || 0),
    subjectTemplate: form.emailSubject,
    bodyTemplate: form.emailBody,
  }),
);

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

const rememberAutoEmail = (
  subject: string,
  body: string,
  language: QuoteLanguage,
) => {
  lastAutoEmailSubject.value = subject;
  lastAutoEmailBody.value = body;
  lastAutoEmailDraft.value = composeLegacyEmailDraft(subject, body, language);
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
  projectId: draft.projectId || "",
  templateId: draft.templateId || "",
  title: draft.title,
  projectName: draft.projectName || "",
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
  investmentSummary: draft.investmentSummary || "",
  investmentAmount: Number(draft.investmentAmount || 0),
  investmentLines: (draft.investmentLines || []).map((line) => ({
    label: line.label || "",
    mode: line.mode || "fixed",
    value: Number(line.value || 0),
    note: line.note || "",
  })),
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
    includeInInvestment: part.includeInInvestment !== false,
    priceNote: part.priceNote,
    sections: (part.sections || []).map((section) => ({
      title: section.title,
      blocks: serializeBlocks(section.blocks || [], { withIds: false }),
    })),
  })),
  conditions: draft.conditions.map((condition) => ({
    title: condition.title,
    tag: condition.tag || "",
    body: condition.body,
    items: normalizeConditionItems(condition).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  roadmap: draft.roadmap.map((phase) => ({
    title: phase.title,
    tag: phase.tag || "",
    body: phase.body,
    items: normalizeConditionItems(phase).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  acceptance: draft.acceptance.map((entry) => ({
    title: entry.title,
    tag: entry.tag || "",
    body: entry.body,
    items: normalizeConditionItems(entry).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
  })),
  principles: draft.principles.map((principle) => ({
    title: principle.title,
    tag: principle.tag || "",
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
  paymentSchedule: clonePaymentSchedule(draft.paymentSchedule || []).map((step) => ({
    label: step.label,
    mode: step.mode,
    value: step.value,
  })),
});

const totals = computed(() => ({
  ...calculateQuotePartsTotals(
    form.parts,
    form.vatRate,
    form.discountType,
    form.discountValue,
    form.investmentAmount,
  ),
  addonsTotal: calculateAddonTotal(form.addons),
}));

const livePreviewQuote = computed<Quote>(() => ({
  id: quoteId.value || "live-preview",
  userId: "local",
  ...form,
  subtotal: totals.value.subtotal,
  totalWithVat: totals.value.totalWithVat,
  createdAt: new Date().toISOString(),
}));

const livePreviewHtml = computed(() =>
  renderQuoteDocumentHtml(livePreviewQuote.value, authStore.userProfile, {
    showPreviewToolbar: false,
  }),
);

const livePreviewStandaloneHtml = computed(() =>
  renderQuoteDocumentHtml(livePreviewQuote.value, authStore.userProfile, {
    showPreviewToolbar: true,
  }),
);
const quotePdfDocumentTitle = computed(() => {
  const quote = livePreviewQuote.value;
  const quoteDate = quote.quoteDate || form.quoteDate;
  const clientName = quote.clientName || form.clientName;
  // La référence reste celle de la V1 pour toute la famille de versions : elle
  // encode donc une date périmée. Le titre du fichier suit la date réelle du devis.
  const reference =
    (quoteDate
      ? generateQuoteReference(clientName, parseQuoteDate(quoteDate))
      : "") ||
    quote.quoteRef ||
    form.quoteRef ||
    "devis";
  const version = Number(quote.version || 1);
  const withVersion = version > 1 ? `${reference}_V${version}` : reference;
  return withVersion.trim().replace(/[\\/:*?"<>|]+/g, "-") || "devis";
});

const getPreviewScrollElement = (): HTMLElement | null => {
  const frameDocument = previewFrame.value?.contentDocument;
  return frameDocument?.scrollingElement as HTMLElement | null;
};

const rememberPreviewScroll = () => {
  const scrollElement = getPreviewScrollElement();
  if (!scrollElement) return;
  previewScrollPosition.value = {
    left: scrollElement.scrollLeft,
    top: scrollElement.scrollTop,
  };
};

const restorePreviewScroll = () => {
  if (!shouldRestorePreviewScroll.value) return;
  const target = { ...previewScrollPosition.value };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollElement = getPreviewScrollElement();
      if (!scrollElement) return;
      scrollElement.scrollTo(target.left, target.top);
      shouldRestorePreviewScroll.value = false;
    });
  });
};

const handlePreviewFrameLoad = () => {
  const frameDocument = previewFrame.value?.contentDocument;
  if (frameDocument) frameDocument.title = quotePdfDocumentTitle.value;
  restorePreviewScroll();
};

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
const syncClientFields = (
  client: Client | null,
  options: { includeLanguage?: boolean } = {},
) => {
  const includeLanguage = options.includeLanguage !== false;
  if (!client) {
    form.clientName = "";
    form.clientAddress = "";
    form.clientWebsite = "";
    form.vatRate = 21;
    return;
  }
  form.clientName = formatClientFullName(client);
  form.clientAddress = formatClientAddress(client);
  form.clientWebsite = client.website || "";
  if (includeLanguage) form.language = client.language;
  form.vatRate = computeVatRateForClient(client, authStore.userProfile);
};
const getLiveClientFields = (clientId: string | undefined, fallback: Quote) => {
  const client = clientId
    ? clientsStore.clients.find((entry) => entry.id === clientId)
    : null;
  if (!client) {
    return {
      clientName: fallback.clientName,
      clientAddress: fallback.clientAddress,
      clientWebsite: fallback.clientWebsite,
      vatRate: fallback.vatRate,
    };
  }
  return {
    clientName: formatClientFullName(client),
    clientAddress: formatClientAddress(client),
    clientWebsite: client.website || "",
    vatRate: computeVatRateForClient(client, authStore.userProfile),
  };
};
const vatExplanation = computed(() =>
  getVatExplanation(selectedClient.value, authStore.userProfile),
);
// La base commune est toujours appliquée : seuls les templates de stack sont proposés.
const templateOptions = computed(() =>
  quoteTemplatesStore.templates
    .filter((template) => template.kind !== "base")
    .map((template) => ({
      label: template.name,
      value: template.id,
    })),
);
const baseTemplateName = computed(
  () => quoteTemplatesStore.baseTemplate?.name || "",
);
// Ouvre l'atelier Templates sur la base commune (contenu prérempli des nouveaux devis).
const editBaseTemplate = () => {
  const base = quoteTemplatesStore.baseTemplate;
  if (base) quoteTemplatesStore.selectTemplate(base.id);
  router.push("/quote-templates");
};
const baselineDraft = computed<QuoteDraft>(() => {
  const current = quotesStore.selectedQuote;
  if (!current) return newQuoteBaseline.value;

  // Les champs client sont recalculés en direct depuis la fiche client (comme
  // dans hydrateFromQuote) pour que la comparaison "modifications non
  // sauvegardées" ne se déclenche pas juste parce que le format d'adresse
  // stocké sur le devis diffère de la fiche client actuelle.
  const liveClientFields = getLiveClientFields(current.clientId || "", current);

  return {
    clientId: current.clientId || "",
    projectId: current.projectId || "",
    templateId: current.templateId || "",
    title: current.title || "",
    projectName: current.projectName || "",
    quoteDate: current.quoteDate || getTodayQuoteDate(),
    quoteRef: current.quoteRef,
    platform: current.platform,
    customPlatformLabel: current.customPlatformLabel || "",
    language: current.language,
    clientName: liveClientFields.clientName,
    clientAddress: liveClientFields.clientAddress,
    clientWebsite: liveClientFields.clientWebsite,
    vatRate: liveClientFields.vatRate,
    projectSummary: current.projectSummary,
    investmentSummary: current.investmentSummary || "",
    investmentAmount: Number(current.investmentAmount || 0),
    investmentLines: cloneInvestmentLines(current.investmentLines || []),
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
    paymentSchedule: resolveQuotePaymentSchedule(current),
    status: current.status,
  };
});
const hasUnsavedChanges = computed(
  () =>
    JSON.stringify(normalizeDraft(form)) !==
    JSON.stringify(normalizeDraft(baselineDraft.value)),
);
// L'index transmet son état de liste dans l'URL : le pas-à-pas suit donc le
// même ordre filtré que le tableau qu'on vient de quitter, et pas la collection
// entière — sinon le compteur « 2 / 32 » mentirait.
const listQuery = computed(() => {
  const { preview: _preview, ...listParams } = route.query;
  return listParams;
});
const siblingQuotes = computed(() =>
  buildQuoteList(quotesStore.quotes, readQuoteListQuery(listQuery.value)),
);
const siblingIndex = computed(() => {
  const selected = quotesStore.selectedQuote;
  if (!selected) return -1;
  const selectedGroupId = selected.versionGroupId || selected.id;
  return siblingQuotes.value.findIndex(
    (quote) => (quote.versionGroupId || quote.id) === selectedGroupId,
  );
});
const previousQuote = computed(() =>
  siblingIndex.value > 0 ? siblingQuotes.value[siblingIndex.value - 1] : null,
);
const nextQuote = computed(() =>
  siblingIndex.value >= 0 && siblingIndex.value < siblingQuotes.value.length - 1
    ? siblingQuotes.value[siblingIndex.value + 1]
    : null,
);

const quoteLanguageLabels: Record<QuoteLanguage, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
};

const headerTitle = computed(
  () => form.clientName?.trim() || form.title?.trim() || "Nouveau devis",
);
const headerPlatform = computed(() =>
  getQuotePlatformLabel(form.platform, form.customPlatformLabel),
);
// Le verrou porte sur le statut **enregistré**, pas sur celui en cours d'édition :
// passer un brouillon à « Envoyé » reste une sauvegarde ordinaire. La création
// d'une nouvelle version est toujours une décision explicite.
const isQuoteLocked = computed(() => {
  const saved = quotesStore.selectedQuote;
  return saved ? quoteStatusMeta[saved.status].locked : false;
});

// Id du devis actuellement chargé (null = nouveau devis non encore enregistré).
// Ne jamais retomber sur un autre devis, sinon la sauvegarde écraserait celui-ci.
const quoteId = computed(() => quotesStore.selectedQuoteId);
const selectedLinkedProject = computed(
  () =>
    projectsStore.projects.find(
      (project) => project.id === quotesStore.selectedQuote?.projectId,
    ) || null,
);
const selectedQuoteMetadata = computed(() => {
  const quote = quotesStore.selectedQuote;
  if (!quoteId.value || !quote) return null;
  return {
    createdAt: formatDateTime(quote.createdAt),
    updatedAt: formatDateTime(quote.updatedAt || quote.createdAt),
  };
});

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
      // Template de stack (contenu, conditions, roadmap, add-ons…) complété
      // par le contenu commun de la base.
      Object.assign(
        form,
        createDraftFromTemplate(explicitTemplate),
        getBaseCommonContent(explicitTemplate.language),
      );
    } else {
      // Sans template : brouillon vierge + contenu commun de la base.
      const draft = createDraft();
      Object.assign(form, draft, getBaseCommonContent(draft.language));
    }
    const nextEmailDraft = buildCurrentStandardEmail();
    form.emailSubject = nextEmailDraft.subject;
    form.emailBody = nextEmailDraft.body;
    form.emailDraft = composeLegacyEmailDraft(
      nextEmailDraft.subject,
      nextEmailDraft.body,
      form.language,
    );
    form.templateId = selectedTemplateId.value || "";
    rememberAutoEmail(nextEmailDraft.subject, nextEmailDraft.body, form.language);
    newQuoteBaseline.value = cloneDraft(form);
    return;
  }

  selectedTemplateId.value = quote.templateId || "";
  const fallbackEmail = splitLegacyEmailDraft(quote.emailDraft || "");
  const rawEmailSubject = quote.emailSubject || fallbackEmail.subject;
  const rawEmailBody = quote.emailBody || fallbackEmail.body;
  const liveClientFields = getLiveClientFields(quote.clientId || "", quote);
  const renderedEmail = buildStandardQuoteEmail({
    language: quote.language,
    clientName: liveClientFields.clientName,
    clientFirstName: resolveClientFirstName(quote.clientId || "", liveClientFields.clientName),
    title: quote.title || "",
    projectName: quote.projectName || "",
    quoteRef: quote.quoteRef,
    hourlyRate: Number(authStore.userProfile?.hourlyRate || 0),
    subjectTemplate: rawEmailSubject,
    bodyTemplate: rawEmailBody,
  });
  const emailSubject = renderedEmail.subject;
  const emailBody = renderedEmail.body;

  Object.assign(form, {
    clientId: quote.clientId || "",
    projectId: quote.projectId || "",
    templateId: quote.templateId || "",
    title: quote.title || "",
    projectName: quote.projectName || "",
    quoteDate: quote.quoteDate || getTodayQuoteDate(),
    quoteRef: quote.quoteRef,
    platform: quote.platform,
    customPlatformLabel: quote.customPlatformLabel || "",
    language: quote.language,
    clientName: liveClientFields.clientName,
    clientAddress: liveClientFields.clientAddress,
    clientWebsite: liveClientFields.clientWebsite,
    vatRate: liveClientFields.vatRate,
    projectSummary: quote.projectSummary,
    investmentSummary: quote.investmentSummary || "",
    investmentAmount: Number(quote.investmentAmount || 0),
    investmentLines: cloneInvestmentLines(quote.investmentLines || []),
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
    paymentSchedule: resolveQuotePaymentSchedule(quote),
    status: quote.status,
  });
  rememberAutoEmail(emailSubject, emailBody, form.language);
  // On repart d'un historique vierge à chaque changement de devis.
  resetQuoteHistory();
};

/*
 * Historique local du formulaire (Cmd/Ctrl+Z, Cmd/Ctrl+Maj+Z).
 * On historise des snapshots JSON du draft ; dans un champ texte on laisse
 * l'annulation native du navigateur agir sur la frappe.
 */
const UNDO_HISTORY_LIMIT = 50;
const undoStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);
let historySnapshot = JSON.stringify(form);
let restoringHistory = false;
let historyTimer: ReturnType<typeof setTimeout> | null = null;

const resetQuoteHistory = () => {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
  undoStack.value = [];
  redoStack.value = [];
  historySnapshot = JSON.stringify(form);
};

// Les frappes rapprochées sont regroupées en une seule entrée d'historique.
watch(
  form,
  () => {
    if (restoringHistory) return;
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      historyTimer = null;
      const next = JSON.stringify(form);
      if (next === historySnapshot) return;
      undoStack.value.push(historySnapshot);
      if (undoStack.value.length > UNDO_HISTORY_LIMIT) undoStack.value.shift();
      redoStack.value = [];
      historySnapshot = next;
    }, 350);
  },
  { deep: true },
);

const applyHistorySnapshot = (snapshot: string) => {
  restoringHistory = true;
  Object.assign(form, JSON.parse(snapshot) as QuoteDraft);
  historySnapshot = snapshot;
  void nextTick(() => {
    restoringHistory = false;
  });
};

/** Vide le regroupement en cours pour ne pas perdre la modification la plus récente. */
const flushPendingHistory = () => {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
  const current = JSON.stringify(form);
  if (current !== historySnapshot) {
    undoStack.value.push(historySnapshot);
    historySnapshot = current;
  }
};

const undoLastChange = () => {
  flushPendingHistory();
  const previous = undoStack.value.pop();
  if (!previous) {
    toast.add({
      severity: "info",
      summary: "Rien à annuler",
      detail: "Aucune modification récente dans ce devis.",
      life: 1800,
    });
    return;
  }
  redoStack.value.push(JSON.stringify(form));
  applyHistorySnapshot(previous);
  toast.add({
    severity: "secondary",
    summary: "Modification annulée",
    detail: "Cmd/Ctrl + Maj + Z pour rétablir.",
    life: 1800,
  });
};

const redoLastChange = () => {
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(JSON.stringify(form));
  applyHistorySnapshot(next);
  toast.add({
    severity: "secondary",
    summary: "Modification rétablie",
    life: 1600,
  });
};

const isTextEditingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
};

const handleUndoShortcut = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() !== "z") return;
  // Dans un champ texte, l'annulation native du navigateur reste prioritaire.
  if (isTextEditingTarget(event.target)) return;
  event.preventDefault();
  if (event.shiftKey) redoLastChange();
  else undoLastChange();
};

const isNewQuoteRoute = computed(() => route.name === "quote-new");
const routeQuoteId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);
/**
 * La route est la source de vérité : /quotes/new ouvre un brouillon vierge,
 * /quotes/:id charge le devis correspondant.
 */
const loadFromRoute = () => {
  if (isNewQuoteRoute.value) {
    selectedTemplateId.value = "";
    quotesStore.selectQuote(null);
    hydrateFromQuote(null);
    const projectId = typeof route.query.project === "string" ? route.query.project : "";
    const project = projectsStore.projects.find((entry) => entry.id === projectId);
    if (project) {
      const client = clientsStore.clients.find((entry) => entry.id === project.clientId) || null;
      form.projectId = project.id;
      form.projectName = project.title;
      form.clientId = project.clientId || "";
      syncClientFields(client);
      if (client) applyStandardContent(client.language);
      form.quoteRef = generateQuoteReference(form.clientName, parseQuoteDate(form.quoteDate));
      const email = buildCurrentStandardEmail();
      form.emailSubject = email.subject;
      form.emailBody = email.body;
      form.emailDraft = composeLegacyEmailDraft(email.subject, email.body, form.language);
      newQuoteBaseline.value = cloneDraft(form);
    }
    return;
  }

  const quote = quotesStore.quotes.find((entry) => entry.id === routeQuoteId.value) || null;
  // Lien périmé ou devis supprimé : mieux vaut renvoyer à la liste qu'afficher
  // un formulaire vide qui ressemblerait à un nouveau devis.
  if (!quote) {
    skipLeaveGuard = true;
    void router.replace({ name: "quotes", query: listQuery.value });
    toast.add({
      severity: "warn",
      summary: "Devis introuvable",
      detail: "Ce devis n’existe plus ou n’est pas accessible.",
      life: 3000,
    });
    return;
  }

  quotesStore.selectQuote(quote.id);
  hydrateFromQuote(quote);
};

const warnBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onMounted(async () => {
  window.addEventListener("keydown", handleUndoShortcut);
  window.addEventListener("beforeunload", warnBeforeUnload);
  await Promise.all([
    quotesStore.fetchQuotes(),
    clientsStore.fetchClients(),
    projectsStore.fetchProjects(),
    quoteTemplatesStore.fetchTemplates(),
  ]);
  loadFromRoute();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleUndoShortcut);
  window.removeEventListener("beforeunload", warnBeforeUnload);
  if (unsavedAttentionTimeout) clearTimeout(unsavedAttentionTimeout);
  if (historyTimer) clearTimeout(historyTimer);
});

// Le pas-à-pas préc./suiv. réutilise le même composant : on recharge sur
// changement de paramètre de route.
watch([() => route.name, routeQuoteId], () => {
  if (!quotesStore.quotes.length && !isNewQuoteRoute.value) return;
  if (quotesStore.selectedQuoteId === routeQuoteId.value && !isNewQuoteRoute.value) return;
  loadFromRoute();
});

watch(
  () => route.query.preview,
  (preview) => {
    previewDialogVisible.value = preview === "live";
  },
  { immediate: true },
);

watch(
  livePreviewHtml,
  () => {
    if (!previewDialogVisible.value) return;
    rememberPreviewScroll();
    shouldRestorePreviewScroll.value = true;
  },
  { flush: "pre" },
);

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
  () => [form.language, form.clientName, form.title, form.projectName, form.quoteRef] as const,
  () => {
    if (hydratingQuote) return;
    const nextEmailDraft = buildCurrentStandardEmail();
    const nextLegacy = composeLegacyEmailDraft(
      nextEmailDraft.subject,
      nextEmailDraft.body,
      form.language,
    );
    const emailStillAuto =
      !form.emailDraft ||
      form.emailDraft === lastAutoEmailDraft.value ||
      (form.emailSubject === lastAutoEmailSubject.value &&
        form.emailBody === lastAutoEmailBody.value);

    if (emailStillAuto) {
      form.emailSubject = nextEmailDraft.subject;
      form.emailBody = nextEmailDraft.body;
      form.emailDraft = nextLegacy;
    }
    rememberAutoEmail(nextEmailDraft.subject, nextEmailDraft.body, form.language);
  },
  { immediate: true },
);

/**
 * Régénère le contenu standard du brouillon dans la langue cible : contenu de
 * stack depuis le template sélectionné (le cas échéant), puis contenu commun
 * depuis la base commune.
 */
const applyStandardContent = (language: QuoteLanguage) => {
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === selectedTemplateId.value,
  );
  if (template) {
    const content = resolveTemplateContent(template, language);
    form.conditions = resolveCommonConditionReferences(
      content.conditions,
      language,
    );
    form.roadmap = content.roadmap;
  } else {
    form.parts = [];
    form.conditions = [];
    form.roadmap = [];
    form.addons = [];
  }
  const baseContent = getBaseCommonContent(language);
  form.acceptance = baseContent.acceptance;
  form.principles = baseContent.principles;
  form.paymentSchedule = baseContent.paymentSchedule;
};

watch(
  () => form.clientId,
  (clientId) => {
    if (hydratingQuote) return;
    const client = clientsStore.clients.find((entry) => entry.id === clientId);
    if (!client) {
      syncClientFields(null);
      applyStandardContent(form.language);
      return;
    }
    syncClientFields(client);
    applyStandardContent(client.language);
  },
);

watch(
  () => {
    const client = selectedClient.value;
    if (!client) return "";
    return [
      client.id,
      client.name,
      client.firstName,
      client.lastName,
      client.street,
      client.streetNumber,
      client.postalCode,
      client.city,
      client.country,
      client.address,
      client.website,
      client.language,
      client.isVatRegistered,
      client.vatNumber,
    ].join("\u001f");
  },
  () => {
    if (hydratingQuote || !form.clientId) return;
    syncClientFields(selectedClient.value, { includeLanguage: false });
  },
);

watch(
  () => [form.platform, form.language] as const,
  ([platform, language], [oldPlatform, oldLanguage]) => {
    if (hydratingQuote) return;
    if (platform === oldPlatform && language === oldLanguage) return;
    if (platform !== "other" && platform !== "custom") form.customPlatformLabel = "";
    if (language !== oldLanguage) applyStandardContent(language);
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
  const estimatedIndex = form.roadmap.length - 1;
  if (field === "title" && form.roadmap[estimatedIndex]?.id === id) return;
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
  const lockedIndex = form.roadmap.length - 1;
  if (draggedIndex === lockedIndex || targetIndex === lockedIndex) return;
  const next = [...form.roadmap];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.roadmap = next;
};

const normalizeEstimatedTimelineTitle = () => {
  const estimatedPhase = form.roadmap[form.roadmap.length - 1];
  if (estimatedPhase) estimatedPhase.title = getEstimatedTimelineTitle(form.language);
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
  field: "title" | "body" | "tag",
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === id);
  if (principle) (principle[field] as string) = value;
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
  const phase = { id: createEntityId(), title: "", body: "", items: [] };
  const insertIndex = Math.max(form.roadmap.length - 1, 0);
  form.roadmap.splice(insertIndex, 0, phase);
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
    tag: "",
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
    input.investmentAmount || 0,
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
  goToQuote(created.id);
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
    payload.investmentAmount || 0,
  );
  const subtotal = quoteTotals.subtotal;
  const totalWithVat = quoteTotals.totalWithVat;

  const duplicated = await quotesStore.saveQuote(null, {
    ...payload,
    subtotal,
    totalWithVat,
  });
  goToQuote(duplicated.id);
  toast.add({
    severity: "success",
    summary: "Devis dupliqué",
    detail: "Un nouveau brouillon a été créé à partir du devis existant.",
    life: 2500,
  });
};

/**
 * Sections du template réappliquables indépendamment sur un devis existant.
 * Le mail, l'acceptation, les principes et l'échéancier viennent de la base
 * commune (bouton « Réappliquer la base »), pas d'ici.
 */
type TemplateSectionKey =
  | "projectSummary"
  | "parts"
  | "conditions"
  | "roadmap"
  | "addons";

const templateSectionOptions: Array<{
  key: TemplateSectionKey;
  label: string;
  hint: string;
}> = [
  {
    key: "projectSummary",
    label: "Résumé du projet",
    hint: "Le texte de présentation du projet",
  },
  {
    key: "parts",
    label: "Parties & prix",
    hint: "Les parties du devis, leurs sections et leurs prix",
  },
  {
    key: "conditions",
    label: "Conditions",
    hint: "Les conditions du template (et les conditions communes liées)",
  },
  {
    key: "roadmap",
    label: "Feuille de route & calendrier",
    hint: "Les phases et le calendrier estimé",
  },
  {
    key: "addons",
    label: "Options complémentaires",
    hint: "Les add-ons proposés en fin de devis",
  },
];

const reapplySectionDialogVisible = ref(false);
const reapplySectionSelection = ref<TemplateSectionKey[]>([]);

const openReapplySectionDialog = () => {
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === selectedTemplateId.value,
  );
  if (!template) return;
  reapplySectionSelection.value = [];
  reapplySectionDialogVisible.value = true;
};

/** Réapplique uniquement les sections demandées, sans toucher au reste du devis. */
const applyTemplateSections = (keys?: TemplateSectionKey[]) => {
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === selectedTemplateId.value,
  );
  const sections = keys ?? reapplySectionSelection.value;
  if (!template || !sections.length) return;

  const targetLanguage = form.language || template.language;
  const nextDraft = createDraftFromTemplate(template, targetLanguage);

  sections.forEach((section) => {
    switch (section) {
      case "projectSummary":
        form.projectSummary = nextDraft.projectSummary;
        break;
      case "parts":
        form.parts = nextDraft.parts;
        break;
      case "conditions":
        form.conditions = nextDraft.conditions;
        break;
      case "roadmap":
        form.roadmap = nextDraft.roadmap;
        break;
      case "addons":
        form.addons = nextDraft.addons;
        break;
    }
  });

  form.templateId = template.id;
  reapplySectionDialogVisible.value = false;

  const appliedLabels = templateSectionOptions
    .filter((option) => sections.includes(option.key))
    .map((option) => option.label)
    .join(", ");
  toast.add({
    severity: "success",
    summary: "Sections réappliquées",
    detail: `${appliedLabels} — depuis le template ${template.name}.`,
    life: 3000,
  });
};

/** Bouton « Réappliquer » d'une section précise, avec confirmation. */
const confirmReapplyTemplateSection = (section: TemplateSectionKey) => {
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === selectedTemplateId.value,
  );
  if (!template) return;
  const option = templateSectionOptions.find((entry) => entry.key === section);
  if (!option) return;

  confirm.require({
    message: `Remplacer « ${option.label} » par la version actuelle du template ${template.name} ? Le reste du devis n’est pas touché.`,
    header: `Réappliquer : ${option.label}`,
    icon: "warning",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Réappliquer",
      severity: "danger",
    },
    accept: () => applyTemplateSections([section]),
  });
};

const applySelectedTemplate = (templateId?: string | null) => {
  const resolvedTemplateId = templateId ?? selectedTemplateId.value;
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === resolvedTemplateId,
  );
  if (!template) return;

  const targetLanguage = form.language || template.language;
  const nextDraft = {
    ...createDraftFromTemplate(template, targetLanguage),
    // Le mail, la validation et les principes restent ceux de la base commune.
    ...getBaseCommonContent(targetLanguage),
  };
  const preserved = {
    clientId: form.clientId,
    clientName: form.clientName,
    clientAddress: form.clientAddress,
    clientWebsite: form.clientWebsite,
    quoteDate: form.quoteDate,
    quoteRef: form.quoteRef,
    title: form.title,
    projectName: form.projectName,
    vatRate: form.vatRate,
    investmentSummary: form.investmentSummary,
    investmentAmount: form.investmentAmount,
    investmentLines: form.investmentLines,
  };

  Object.assign(form, nextDraft, preserved);
  form.templateId = template.id;
  selectedTemplateId.value = template.id;

  const nextEmailDraft = buildCurrentStandardEmail();
  form.emailSubject = nextEmailDraft.subject;
  form.emailBody = nextEmailDraft.body;
  form.emailDraft = composeLegacyEmailDraft(
    nextEmailDraft.subject,
    nextEmailDraft.body,
    form.language,
  );
  rememberAutoEmail(nextEmailDraft.subject, nextEmailDraft.body, form.language);

  toast.add({
    severity: "secondary",
    summary: "Template appliqué",
    detail: `Le template ${template.name} a été appliqué au devis.`,
    life: 2200,
  });
};

const handleTemplateSelection = (value: string | null) => {
  selectedTemplateId.value = value;
  form.templateId = value || "";
  if (!value) {
    form.parts = [];
    form.conditions = [];
    form.roadmap = [];
    form.addons = [];
    form.paymentSchedule = getBaseCommonContent(form.language).paymentSchedule;
    return;
  }
  applySelectedTemplate(value);
};

const confirmReapplyTemplate = () => {
  openReapplySectionDialog();
};

const applyBaseCommonContentToQuote = () => {
  const baseContent = getBaseCommonContent(form.language);
  form.acceptance = baseContent.acceptance;
  form.principles = baseContent.principles;
  form.paymentSchedule = baseContent.paymentSchedule;

  const nextEmailDraft = buildCurrentStandardEmail();
  form.emailSubject = nextEmailDraft.subject;
  form.emailBody = nextEmailDraft.body;
  form.emailDraft = composeLegacyEmailDraft(
    nextEmailDraft.subject,
    nextEmailDraft.body,
    form.language,
  );
  rememberAutoEmail(nextEmailDraft.subject, nextEmailDraft.body, form.language);

  toast.add({
    severity: "success",
    summary: "Base commune mise à jour",
    detail: "Le mail, l’acceptation, les principes et l’échéancier ont été réappliqués au devis.",
    life: 2800,
  });
};

const confirmApplyBaseCommonContent = () => {
  confirm.require({
    message:
      "Mettre à jour la base commune va remplacer dans ce devis le mail, l’acceptation, les principes et l’échéancier par la version actuelle de la base commune. Le contenu du template, les parties, conditions et options ne seront pas touchés. Continuer ?",
    header: "Mettre à jour la base commune ?",
    icon: "info",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Mettre à jour",
      severity: "primary",
    },
    accept: applyBaseCommonContentToQuote,
  });
};

const saveQuote = async () => {
  normalizeEstimatedTimelineTitle();
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

  const wasNew = !quoteId.value;
  const saved = await quotesStore.saveQuote(quoteId.value, payload);
  if (saved.status === "accepted" && saved.projectId) {
    const project = projectsStore.projects.find((entry) => entry.id === saved.projectId);
    if (project) await projectsStore.attachQuotesToProject(project, [saved]);
  }
  // Un nouveau devis a désormais une URL propre : on la substitue sans empiler
  // /quotes/new dans l'historique.
  if (wasNew) goToQuote(saved.id);
  toast.add({
    severity: "success",
    summary: "Devis sauvegardé",
    detail: "Le devis a été enregistré.",
    life: 2500,
  });
};

const previewPdf = () => {
  previewDialogVisible.value = true;
  void router.replace({ query: { ...route.query, preview: "live" } });
};

const closeLivePreview = () => {
  previewDialogVisible.value = false;
  const query = { ...route.query };
  delete query.preview;
  void router.replace({ query });
};

const printLivePreview = () => {
  const frameWindow = previewFrame.value?.contentWindow;
  if (!frameWindow) return;
  const previousDocumentTitle = document.title;
  const frameDocument = previewFrame.value?.contentDocument;
  if (frameDocument) frameDocument.title = quotePdfDocumentTitle.value;
  document.title = quotePdfDocumentTitle.value;
  frameWindow.focus();
  frameWindow.print();
  window.setTimeout(() => {
    document.title = previousDocumentTitle;
  }, 500);
};

const openLivePreviewInNewTab = () => {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    toast.add({
      severity: "warn",
      summary: "Fenêtre bloquée",
      detail: "Autorise les pop-ups pour ouvrir l’aperçu dans un nouvel onglet.",
      life: 3500,
    });
    return;
  }

  previewWindow.opener = null;
  previewWindow.document.open();
  previewWindow.document.write(livePreviewStandaloneHtml.value);
  previewWindow.document.close();
  previewWindow.document.title = quotePdfDocumentTitle.value;
};

const deleteQuote = () => {
  if (!quoteId.value) {
    hydrateFromQuote(null);
    return;
  }

  const current = quotesStore.selectedQuote;
  const quoteLabel =
    current?.title?.trim() || current?.quoteRef || "ce devis";
  confirm.require({
    message: `Supprimer définitivement ${quoteLabel} ?`,
    header: "Supprimer le devis ?",
    icon: "warning",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Supprimer",
      severity: "danger",
    },
    accept: async () => {
      await quotesStore.deleteQuote(quoteId.value as string);
      skipLeaveGuard = true;
      await router.push({ name: "quotes", query: listQuery.value });
      toast.add({
        severity: "secondary",
        summary: "Devis supprimé",
        detail: "Le devis a été retiré.",
        life: 2000,
      });
    },
  });
};

const copyEmailSubject = async () => {
  const success = await copyToClipboard(renderedEmail.value.subject);
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
  const success = await copyToClipboard(renderedEmail.value.body);
  if (success) {
    toast.add({
      severity: "secondary",
      summary: "Contenu copié",
      detail: "Le contenu a été ajouté au presse-papiers.",
      life: 1800,
    });
  }
};

const openEmailClient = () => {
  const recipient = selectedClient.value?.contactEmail?.trim() || "";
  const sender = authStore.userProfile?.contactEmail?.trim() || "";
  const params: Array<[string, string]> = [];
  if (sender) {
    params.push(["account", sender]);
    params.push(["from", sender]);
  }
  if (recipient) {
    params.push(["to", recipient]);
  }
  if (renderedEmail.value.subject.trim()) {
    params.push(["subject", renderedEmail.value.subject.trim()]);
  }
  if (renderedEmail.value.body.trim()) {
    params.push(["body", renderedEmail.value.body.trim()]);
  }

  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const outlookAppUrl = `ms-outlook://emails/new?${query}`;
  const link = document.createElement("a");
  link.href = outlookAppUrl;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

const openLinkedProject = () => {
  const project = selectedLinkedProject.value;
  if (!project) return;
  projectsStore.selectProject(project.id);
  void router.push({ name: "project-detail", params: { id: project.id } });
};

const backToList = () => {
  const returnProjectId =
    typeof route.query.retourProjet === "string" ? route.query.retourProjet : "";
  if (returnProjectId) {
    void router.push({ name: "project-detail", params: { id: returnProjectId } });
    return;
  }
  void router.push({ name: "quotes", query: listQuery.value });
};

const goToQuote = (id: string) => {
  void router.replace({ name: "quote-detail", params: { id }, query: route.query });
};

const goToSibling = (quote: Quote | null) => {
  if (!quote) return;
  void router.push({ name: "quote-detail", params: { id: quote.id }, query: route.query });
};

/**
 * Garde de navigation à trois issues. On sort du devis par un vrai changement
 * de route : bloquer silencieusement (l'ancien comportement) laisserait
 * l'utilisateur coincé sans comprendre pourquoi le clic ne fait rien.
 */
const leaveDialogVisible = ref(false);
const leaveSaving = ref(false);
let pendingLeave: (() => void) | null = null;
let skipLeaveGuard = false;

onBeforeRouteLeave((to, _from, next) => {
  if (skipLeaveGuard || !hasUnsavedChanges.value) {
    skipLeaveGuard = false;
    next();
    return;
  }
  // Le pas-à-pas et l'enregistrement d'un nouveau devis restent sur le même
  // écran : seule une sortie réelle déclenche la garde.
  if (to.name === "quote-detail" && to.params.id === routeQuoteId.value) {
    next();
    return;
  }

  pendingLeave = () => next();
  leaveDialogVisible.value = true;
});

const quoteMenu = ref<InstanceType<typeof Menu> | null>(null);

const quoteMenuItems = computed(() => [
  ...(selectedLinkedProject.value
    ? [
        {
          label: "Ouvrir le projet lié",
          icon: "pi pi-briefcase",
          command: openLinkedProject,
        },
      ]
    : []),
  ...(quoteId.value
    ? [
        { label: "Dupliquer", icon: "pi pi-copy", command: duplicateCurrentQuote },
        { separator: true },
        { label: "Supprimer", icon: "pi pi-trash", command: deleteQuote },
      ]
    : []),
  ...(quoteId.value ? [] : [{ label: "Réinitialiser", icon: "pi pi-undo", command: discardChanges }]),
]);

const toggleQuoteMenu = (event: Event) => {
  quoteMenu.value?.toggle(event);
};

const stayOnQuote = () => {
  leaveDialogVisible.value = false;
  pendingLeave = null;
};

const leaveWithoutSaving = () => {
  leaveDialogVisible.value = false;
  const proceed = pendingLeave;
  pendingLeave = null;
  skipLeaveGuard = true;
  proceed?.();
};

const saveThenLeave = async () => {
  leaveSaving.value = true;
  try {
    await saveQuote();
    leaveWithoutSaving();
  } finally {
    leaveSaving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div
      class="sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-3xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
      :class="{ 'quotes-unsaved-nudge': unsavedAttention }"
    >
      <div class="flex min-w-0 flex-1 basis-[340px] items-center gap-3">
        <Button
          text
          severity="secondary"
          class="!h-9 !w-9 !shrink-0 !rounded-xl !p-0"
          aria-label="Retour à la liste des devis"
          title="Retour à la liste des devis"
          @click="backToList"
        >
          <template #icon><span class="material-symbols-outlined text-lg">arrow_back</span></template>
        </Button>

        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate font-heading text-lg font-bold text-surface-dark">
              {{ headerTitle }}
            </h1>
            <span
              v-if="form.version > 1"
              class="shrink-0 rounded-md bg-surface-dark/8 px-1.5 py-px text-[11px] font-semibold text-surface-dark/70"
            >
              v{{ form.version }}
            </span>
            <span
              class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="quoteStatusMeta[form.status].tagClass"
            >
              {{ quoteStatusMeta[form.status].label }}
            </span>
          </div>
          <p class="truncate text-xs text-surface-dark/55">
            <span class="font-mono">{{ form.quoteRef }}</span>
            <template v-if="headerPlatform"> · {{ headerPlatform }}</template>
            · {{ quoteLanguageLabels[form.language] }}
            <template v-if="form.quoteDate"> · {{ formatQuoteDate(form.quoteDate) }}</template>
          </p>
        </div>

        <div
          v-if="siblingIndex >= 0 && siblingQuotes.length > 1"
          class="ml-1 flex shrink-0 items-center gap-0.5 border-l border-surface-dark/8 pl-2"
        >
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Devis précédent"
            :disabled="!previousQuote"
            @click="goToSibling(previousQuote)"
          >
            <template #icon><span class="material-symbols-outlined text-lg">chevron_left</span></template>
          </Button>
          <span class="whitespace-nowrap px-1 text-[11px] tabular-nums text-surface-dark/40">
            {{ siblingIndex + 1 }} / {{ siblingQuotes.length }}
          </span>
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Devis suivant"
            :disabled="!nextQuote"
            @click="goToSibling(nextQuote)"
          >
            <template #icon><span class="material-symbols-outlined text-lg">chevron_right</span></template>
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="hasUnsavedChanges"
          class="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-amber-700"
        >
          <span class="h-[7px] w-[7px] rounded-full bg-current"></span>
          Non sauvegardé
        </span>
        <Button
          v-if="hasUnsavedChanges"
          text
          severity="secondary"
          class="!rounded-xl"
          label="Annuler"
          @click="discardChanges"
        >
          <template #icon><span class="material-symbols-outlined text-lg">undo</span></template>
        </Button>
        <Button
          severity="secondary"
          outlined
          class="!rounded-xl"
          label="Prévisualiser"
          @click="previewPdf"
        >
          <template #icon><span class="material-symbols-outlined text-lg">visibility</span></template>
        </Button>
        <Button
          v-if="isQuoteLocked && quoteId"
          severity="secondary"
          outlined
          class="!rounded-xl"
          :label="`Créer la v${form.version + 1}`"
          title="Figer ce devis et repartir sur une nouvelle version"
          @click="createNewVersion"
        >
          <template #icon><span class="material-symbols-outlined text-lg">difference</span></template>
        </Button>
        <Button
          class="!rounded-xl !px-5 font-semibold"
          label="Sauvegarder"
          :disabled="!hasUnsavedChanges"
          @click="saveQuote"
        >
          <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        </Button>
        <Button
          text
          severity="secondary"
          class="!h-9 !w-9 !rounded-xl !p-0"
          aria-label="Autres actions"
          @click="toggleQuoteMenu"
        >
          <template #icon><span class="material-symbols-outlined text-lg">more_vert</span></template>
        </Button>
        <Menu ref="quoteMenu" :model="quoteMenuItems" popup />
      </div>
    </div>

    <div
      class="grid grid-cols-1 gap-6"
      :class="
        previewDialogVisible
          ? 'xl:grid-cols-[minmax(540px,1fr)_minmax(460px,0.9fr)]'
          : 'xl:grid-cols-[minmax(0,1fr)_300px]'
      "
    >
      <div class="flex min-w-0 flex-col gap-6">
        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4">
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
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                severity="secondary"
                outlined
                :disabled="!selectedTemplateId"
                @click="confirmReapplyTemplate"
                label="Réappliquer…"
                title="Choisir les sections du template à réappliquer"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >restart_alt</span
                  ></template
                ></Button>
              <Button
                text
                severity="secondary"
                @click="$router.push('/quote-templates')" label="Gérer les templates">
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >library_books</span
                  ></template
                ></Button>
            </div>
          </div>
          <p class="mt-3 flex flex-wrap items-center gap-1 text-xs text-surface-dark/55">
            <template v-if="baseTemplateName">
              <span class="material-symbols-outlined text-sm text-primary">verified</span>
              <strong class="text-surface-dark/75">{{ baseTemplateName }}</strong> — mail, validation &amp; principes appliqués à tous les devis. Les conditions communes restent disponibles dans les templates.
              <button type="button" class="font-medium text-primary hover:underline" @click="editBaseTemplate">
                Modifier la base
              </button>
              <Button
                text
                severity="secondary"
                size="small"
                class="!ml-1 !rounded-xl !px-2 !py-1"
                label="Réappliquer la base"
                @click="confirmApplyBaseCommonContent"
              >
                <template #icon>
                  <span class="material-symbols-outlined text-base">restart_alt</span>
                </template>
              </Button>
            </template>
            <template v-else>
              Les nouveaux devis utilisent un contenu de base intégré.
              <button type="button" class="font-medium text-primary hover:underline" @click="editBaseTemplate">
                Créer la base commune
              </button>
            </template>
          </p>
        </div>

        <QuoteBuilderForm
          :quote-ref="form.quoteRef"
          :title="form.title"
          :project-name="form.projectName"
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
          :investment-summary="form.investmentSummary"
          :investment-amount="form.investmentAmount"
          :investment-lines="form.investmentLines"
          :can-reapply-template="Boolean(selectedTemplateId)"
          :parts="form.parts"
          :currency-locale="currencyLocale"
          :status="form.status"
          :version="form.version"
          :conditions="form.conditions"
          :roadmap="form.roadmap"
          :acceptance="form.acceptance"
          :principles="form.principles"
          :addons="form.addons"
          :payment-schedule="form.paymentSchedule"
          :clients="clientsStore.clients"
          :addons-total="totals.addonsTotal"
          :discount-amount="totals.discountAmount"
          :subtotal="totals.subtotal"
          :vat-amount="totals.vatAmount"
          :total-with-vat="totals.totalWithVat"
          :vat-explanation="vatExplanation"
          @update:title="form.title = $event"
          @update:project-name="form.projectName = $event"
          @update:quote-date="updateQuoteDate"
          @update:client-id="form.clientId = $event"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="updateDiscountType"
          @update:discount-value="updateDiscountValue"
          @update:project-summary="form.projectSummary = $event"
          @update:investment-summary="form.investmentSummary = $event"
          @update:investment-amount="form.investmentAmount = $event"
          @update:investment-lines="form.investmentLines = $event"
          @reapply-template-section="confirmReapplyTemplateSection"
          @update:parts="form.parts = $event"
          @update:payment-schedule="form.paymentSchedule = $event"
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
          :email-subject="renderedEmail.subject"
          :email-body="renderedEmail.body"
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
          @open-email-client="openEmailClient"
        />
      </div>

      <aside
        v-if="!previewDialogVisible"
        class="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start"
      >
        <div class="rounded-2xl border border-surface-dark/6 bg-surface-card p-4 shadow-sm">
          <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">
            Totaux
          </p>
          <div class="flex flex-col gap-2 tabular-nums">
            <div class="flex items-baseline justify-between gap-3 text-sm text-surface-dark/70">
              Sous-total
              <span class="font-semibold text-surface-dark">
                {{ formatCurrency(totals.partsSubtotal, currencyLocale) }}
              </span>
            </div>
            <div
              v-if="totals.discountAmount > 0"
              class="flex items-baseline justify-between gap-3 text-sm text-amber-700"
            >
              Remise
              <span class="font-semibold">
                − {{ formatCurrency(totals.discountAmount, currencyLocale) }}
              </span>
            </div>
            <div class="flex items-baseline justify-between gap-3 text-sm text-surface-dark/70">
              TVA {{ form.vatRate }} %
              <span class="font-semibold text-surface-dark">
                {{ formatCurrency(totals.vatAmount, currencyLocale) }}
              </span>
            </div>
            <div
              v-if="totals.addonsTotal > 0"
              class="flex items-baseline justify-between gap-3 text-sm text-surface-dark/70"
            >
              Options (hors total)
              <span class="font-semibold text-surface-dark">
                {{ formatCurrency(totals.addonsTotal, currencyLocale) }}
              </span>
            </div>
            <div
              class="mt-1 flex items-baseline justify-between gap-3 border-t border-surface-dark/12 pt-3"
            >
              <span class="text-xs font-semibold uppercase tracking-wider text-surface-dark/35">
                Total TTC
              </span>
              <span class="font-heading text-xl font-bold text-surface-dark">
                {{ formatCurrency(totals.totalWithVat, currencyLocale) }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="selectedQuoteMetadata || selectedLinkedProject"
          class="rounded-2xl border border-surface-dark/6 bg-surface-card p-4 shadow-sm"
        >
          <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">
            Suivi
          </p>
          <div class="flex flex-col gap-2 text-xs">
            <div
              v-if="selectedQuoteMetadata"
              class="flex items-baseline justify-between gap-3 text-surface-dark/50"
            >
              Créé le
              <span class="text-right text-surface-dark/70">
                {{ selectedQuoteMetadata.createdAt }}
              </span>
            </div>
            <div
              v-if="selectedQuoteMetadata"
              class="flex items-baseline justify-between gap-3 text-surface-dark/50"
            >
              Modifié le
              <span class="text-right text-surface-dark/70">
                {{ selectedQuoteMetadata.updatedAt }}
              </span>
            </div>
            <div
              v-if="selectedLinkedProject"
              class="flex items-baseline justify-between gap-3 text-surface-dark/50"
            >
              Projet lié
              <button
                type="button"
                class="text-right font-semibold text-primary hover:underline"
                @click="openLinkedProject"
              >
                {{ selectedLinkedProject.title }}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <section
        v-if="previewDialogVisible"
        class="sticky top-6 flex h-[calc(100vh-3rem)] min-h-[680px] flex-col overflow-hidden rounded-3xl border border-surface-dark/10 bg-surface-light shadow-[0_8px_28px_rgba(47,43,61,0.12)]"
      >
        <div
          class="flex items-center justify-end gap-2 border-b border-surface-dark/8 bg-white px-4 py-3"
        >
            <Button
              text
              severity="secondary"
              class="!h-10 !w-10 !rounded-xl !p-0"
              aria-label="Ouvrir dans un nouvel onglet"
              title="Ouvrir dans un nouvel onglet"
              @click="openLivePreviewInNewTab"
            >
              <template #icon>
                <span class="material-symbols-outlined text-lg">open_in_new</span>
              </template>
            </Button>
            <Button
              severity="secondary"
              class="!rounded-xl"
              label="Imprimer / enregistrer"
              @click="printLivePreview"
            >
              <template #icon>
                <span class="material-symbols-outlined text-lg">print</span>
              </template>
            </Button>
            <Button
              text
              severity="secondary"
              class="!h-10 !w-10 !rounded-xl !p-0"
              aria-label="Fermer l’aperçu"
              @click="closeLivePreview"
            >
              <template #icon>
                <span class="material-symbols-outlined text-lg">close</span>
              </template>
            </Button>
        </div>
        <iframe
          ref="previewFrame"
          title="Prévisualisation live du devis"
          class="min-h-0 flex-1 border-0 bg-white"
          :srcdoc="livePreviewHtml"
          @load="handlePreviewFrameLoad"
        ></iframe>
      </section>
    </div>

    <!-- Réapplication sélective : on ne réécrase que les sections cochées. -->
    <Dialog
      v-model:visible="reapplySectionDialogVisible"
      modal
      :draggable="false"
      dismissable-mask
      header="Réappliquer des sections du template"
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
      <p class="mb-4 text-sm text-surface-dark/60">
        Coche uniquement les sections à remplacer par la version actuelle du
        template. Le reste du devis n’est pas touché.
      </p>
      <div class="flex flex-col gap-2">
        <label
          v-for="option in templateSectionOptions"
          :key="option.key"
          :for="`reapply-${option.key}`"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-dark/8 bg-surface-light p-3 transition hover:border-primary/30"
        >
          <Checkbox
            v-model="reapplySectionSelection"
            :input-id="`reapply-${option.key}`"
            :value="option.key"
          />
          <span class="flex min-w-0 flex-col">
            <span class="text-sm font-semibold text-surface-dark">{{ option.label }}</span>
            <span class="text-xs text-surface-dark/50">{{ option.hint }}</span>
          </span>
        </label>
      </div>
      <template #footer>
        <Button
          text
          severity="secondary"
          :label="
            reapplySectionSelection.length === templateSectionOptions.length
              ? 'Tout décocher'
              : 'Tout sélectionner'
          "
          @click="
            reapplySectionSelection =
              reapplySectionSelection.length === templateSectionOptions.length
                ? []
                : templateSectionOptions.map((option) => option.key)
          "
        />
        <Button
          text
          severity="secondary"
          label="Annuler"
          @click="reapplySectionDialogVisible = false"
        />
        <Button
          severity="danger"
          :disabled="!reapplySectionSelection.length"
          :label="
            reapplySectionSelection.length
              ? `Réappliquer (${reapplySectionSelection.length})`
              : 'Réappliquer'
          "
          @click="applyTemplateSections()"
        >
          <template #icon>
            <span class="material-symbols-outlined text-lg">restart_alt</span>
          </template>
        </Button>
      </template>
    </Dialog>

    <!-- Garde de navigation : trois issues, dont celle qu'on veut neuf fois sur dix. -->
    <Dialog
      v-model:visible="leaveDialogVisible"
      modal
      :draggable="false"
      :closable="false"
      header="Quitter sans sauvegarder ?"
      :style="{ width: '26rem', maxWidth: '92vw' }"
      @hide="stayOnQuote"
    >
      <p class="text-sm text-surface-dark/60">
        Le devis {{ form.quoteRef }} a des modifications non sauvegardées. Elles seront perdues si
        vous quittez maintenant.
      </p>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <Button
            text
            severity="secondary"
            class="!rounded-xl"
            label="Quitter sans sauvegarder"
            :disabled="leaveSaving"
            @click="leaveWithoutSaving"
          />
          <Button
            severity="secondary"
            outlined
            class="!rounded-xl"
            label="Rester"
            :disabled="leaveSaving"
            @click="stayOnQuote"
          />
          <Button
            class="!rounded-xl font-semibold"
            label="Sauvegarder et quitter"
            :loading="leaveSaving"
            @click="saveThenLeave"
          />
        </div>
      </template>
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
