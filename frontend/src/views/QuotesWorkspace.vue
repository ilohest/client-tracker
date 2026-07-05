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
import ConfirmDialog from "primevue/confirmdialog";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ClientFormDialog from "@/components/clients/ClientFormDialog.vue";
import QuoteActionBar from "@/components/quotes/QuoteActionBar.vue";
import QuoteBuilderForm from "@/components/quotes/QuoteBuilderForm.vue";
import QuoteListPanel from "@/components/quotes/QuoteListPanel.vue";
import QuoteOutputPanel from "@/components/quotes/QuoteOutputPanel.vue";
import QuoteTablePanel from "@/components/quotes/QuoteTablePanel.vue";
import {
  createBlankAddon,
  createDefaultPaymentSchedule,
  createDefaultQuoteAcceptance,
  createDefaultQuotePrinciples,
  getEstimatedTimelineTitle,
  quoteEmailPresets,
} from "@/lib/clientPresets";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { formatClientAddress, formatClientFullName } from "@/utils/address";
import { copyToClipboard } from "@/utils/clipboard";
import { formatDateTime } from "@/utils/date";
import { renderQuoteDocumentHtml } from "@/utils/quotePdf";
import {
  calculateAddonTotal,
  calculateQuotePartsTotals,
  clonePaymentSchedule,
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
import { resolveCommonConditionReferences as resolveSharedCommonConditionReferences } from "@/utils/quoteTemplateDraft";
import { computeVatRateForClient, getVatExplanation } from "@/utils/vat";
import { useRoute, useRouter } from "vue-router";

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
const mobileEditorVisible = ref(false);
const isCompactQuotesView = ref(false);
const quoteSearch = ref("");
const quoteFilterClientId = ref("");
const quoteFilterDateRange = ref<Date[] | null>(null);
const quoteFilterStatus = ref<QuoteStatus | "">("");
const selectedTemplateId = ref<string | null>("");
const lastAutoEmailDraft = ref("");
const lastAutoEmailSubject = ref("");
const lastAutoEmailBody = ref("");
const unsavedAttention = ref(false);
// Empêche les watchers de régénérer le contenu par défaut pendant le chargement
// d'un devis (sinon le formulaire diffère toujours de la référence → faux « modifié »).
let hydratingQuote = false;

let unsavedAttentionTimeout: ReturnType<typeof setTimeout> | null = null;

const syncCompactMode = () => {
  isCompactQuotesView.value = window.innerWidth < 1024;
};

// Brouillon vierge : le contenu de stack (conditions, roadmap, add-ons…) vient
// d'un template ; le mail, la validation et les principes viennent de la base commune.
// Les conditions communes sont référencées par les templates pour rester ordonnables.
const createDraft = (): QuoteDraft => ({
  clientId: "",
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
      description: section.description,
      displayMode: section.displayMode || "bullets",
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
  const reference = (livePreviewQuote.value.quoteRef || form.quoteRef || "devis").trim();
  return reference.replace(/[\\/:*?"<>|]+/g, "-") || "devis";
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

  return {
    clientId: current.clientId || "",
    templateId: current.templateId || "",
    title: current.title || "",
    projectName: current.projectName || "",
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
    investmentSummary: current.investmentSummary || "",
    investmentAmount: Number(current.investmentAmount || 0),
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
const filteredQuotes = computed(() => {
  const query = quoteSearch.value.trim().toLowerCase();
  const clientId = quoteFilterClientId.value;
  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
  const [filterStart, filterEnd] = quoteFilterDateRange.value || [];
  const startDate = filterStart ? formatDate(filterStart) : "";
  const endDate = filterEnd ? formatDate(filterEnd) : startDate;

  const status = quoteFilterStatus.value;

  return quotesStore.quotes.filter((quote) => {
    if (clientId && quote.clientId !== clientId) return false;
    if (startDate && (!quote.quoteDate || quote.quoteDate < startDate || quote.quoteDate > endDate)) return false;
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
const selectedLinkedProject = computed(
  () => projectsStore.projects.find((project) => project.quoteId === quoteId.value) || null,
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
};

onMounted(async () => {
  syncCompactMode();
  window.addEventListener("resize", syncCompactMode);
  await Promise.all([
    quotesStore.fetchQuotes(),
    clientsStore.fetchClients(),
    projectsStore.fetchProjects(),
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
    payload.investmentAmount || 0,
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
  const template = quoteTemplatesStore.templates.find(
    (entry) => entry.id === selectedTemplateId.value,
  );
  if (!template) return;

  confirm.require({
    message:
      "Réappliquer ce template va écraser le contenu déjà présent dans ce devis : parties, conditions, feuille de route, options complémentaires, mail et échéancier. Continuer ?",
    header: "Réappliquer le template ?",
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
    accept: () => applySelectedTemplate(template.id),
  });
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

  await quotesStore.saveQuote(quoteId.value, payload);
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
      hydrateFromQuote(quotesStore.selectedQuote);
      if (isCompactQuotesView.value) mobileEditorVisible.value = false;
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

const guardUnsavedViewChange = (action: () => void) => {
  if (hasUnsavedChanges.value) {
    notifyUnsavedBlockedAction();
    return;
  }
  action();
};

const openLinkedProject = () => {
  guardUnsavedViewChange(() => {
    const project = selectedLinkedProject.value;
    if (!project) return;
    projectsStore.selectProject(project.id);
    router.push({ name: "projects" });
  });
};

const openCreateQuote = () => {
  guardUnsavedViewChange(() => {
    selectedTemplateId.value = "";
    quotesStore.selectQuote(null);
    hydrateFromQuote(null);
    if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  });
};

watch(
  () => route.query.new,
  (value) => {
    if (value !== "1") return;
    openCreateQuote();
    const query = { ...route.query };
    delete query.new;
    void router.replace({ query });
  },
  { immediate: true },
);

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
    <ConfirmDialog />

    <div class="flex items-center gap-3">
      <span
        class="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-2xl text-primary"
        >receipt_long</span
      >
      <h1 class="text-3xl font-heading font-bold text-surface-dark">Devis</h1>
    </div>

    <div class="lg:hidden">
      <QuoteTablePanel
        :quotes="filteredQuotes"
        :clients="clientsStore.clients"
        :search="quoteSearch"
        :filter-client-id="quoteFilterClientId"
        :filter-date-range="quoteFilterDateRange"
        :filter-status="quoteFilterStatus"
        @create="openCreateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date-range="quoteFilterDateRange = $event"
        @update:filter-status="quoteFilterStatus = $event"
      />
    </div>

    <div
      class="hidden lg:grid grid-cols-1 gap-6 items-start"
      :class="
        previewDialogVisible
          ? 'xl:grid-cols-[minmax(540px,1fr)_minmax(460px,0.9fr)]'
          : 'xl:grid-cols-[340px_minmax(0,1fr)]'
      "
    >
      <QuoteListPanel
        v-if="!previewDialogVisible"
        :quotes="filteredQuotes"
        :selected-quote-id="quoteId"
        :clients="clientsStore.clients"
        :search="quoteSearch"
        :filter-client-id="quoteFilterClientId"
        :filter-date-range="quoteFilterDateRange"
        :filter-status="quoteFilterStatus"
        @create="openCreateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date-range="quoteFilterDateRange = $event"
        @update:filter-status="quoteFilterStatus = $event"
      />

      <div class="flex flex-col gap-6">
        <QuoteActionBar
          :can-duplicate="Boolean(quoteId)"
          :can-delete="Boolean(quoteId)"
          :can-open-project="Boolean(selectedLinkedProject)"
          show-pdf
          :has-unsaved-changes="hasUnsavedChanges"
          :attention="unsavedAttention"
          @save="saveQuote"
          @discard="discardChanges"
          @download-pdf="previewPdf"
          @open-project="openLinkedProject"
          @duplicate="duplicateCurrentQuote"
          @delete="deleteQuote"
        />

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
                label="Réappliquer"
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
                label="Réappliquer"
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
        <p
          v-if="selectedQuoteMetadata"
          class="rounded-2xl border border-surface-dark/6 bg-white px-4 py-3 text-xs text-surface-dark/45"
        >
          Créé : {{ selectedQuoteMetadata.createdAt }} · Dernière modification :
          {{ selectedQuoteMetadata.updatedAt }}
        </p>
      </div>

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
            <Button text severity="secondary" @click="closeMobileEditor" label="Retour à la liste">
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >arrow_back</span
                ></template
              ></Button>
            <p class="min-w-0 truncate text-sm font-semibold text-surface-dark">
              {{ form.title || form.clientName || "Nouveau devis" }}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button
              v-if="selectedLinkedProject"
              text
              severity="secondary"
              size="small"
              class="!rounded-xl !border !border-amber-500/15 !bg-amber-500/10 !text-surface-dark hover:!border-amber-500/30 hover:!bg-amber-500/15"
              label="Projet"
              @click="openLinkedProject"
            >
              <template #icon><span class="material-symbols-outlined text-lg text-amber-600">workspaces</span></template>
            </Button>
            <Button text severity="secondary" size="small" class="!rounded-xl" @click="duplicateCurrentQuote" label="Dupliquer">
              <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template></Button>
            <Button text severity="danger" size="small" class="!rounded-xl" aria-label="Supprimer" title="Supprimer" @click="deleteQuote">
              <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
            </Button>
            <Button severity="secondary" outlined size="small" class="!rounded-xl" @click="previewPdf" label="Aperçu">
              <template #icon><span class="material-symbols-outlined text-lg">visibility</span></template></Button>
            <Button size="small" class="!rounded-xl font-semibold" label="Sauvegarder" @click="saveQuote">
              <template #icon><span class="material-symbols-outlined text-lg">save</span></template></Button>
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
                >Modifications non enregistrées</span
              >
            </div>
            <div class="flex items-center gap-2">
              <Button
                severity="secondary"
                size="small"
                label="Annuler"
                @click="discardChanges"
              />
              <Button size="small" label="Sauvegarder" @click="saveQuote">
                <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
              </Button>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4">
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
            <div class="flex flex-wrap items-center gap-2">
              <Button
                severity="secondary"
                outlined
                :disabled="!selectedTemplateId"
                @click="confirmReapplyTemplate"
                label="Réappliquer"
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
                label="Réappliquer"
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
