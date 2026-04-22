<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { ClientInput, Quote, QuoteAddon, QuoteCondition, QuoteConditionItem, QuoteConditionSubItem, QuoteDiscountType, QuoteInput, QuoteLanguage, QuoteSection } from '@client-tracker/contracts';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import ClientFormDialog from '@/components/clients/ClientFormDialog.vue';
import QuoteBuilderForm from '@/components/quotes/QuoteBuilderForm.vue';
import QuoteListPanel from '@/components/quotes/QuoteListPanel.vue';
import QuoteOutputPanel from '@/components/quotes/QuoteOutputPanel.vue';
import QuoteTablePanel from '@/components/quotes/QuoteTablePanel.vue';
import { createAddonPresets, createBlankAddon, createDefaultQuoteConditions, createDefaultQuoteSections } from '@/lib/clientPresets';
import { generateQuoteProjectDescription } from '@/services/aiService';
import { useAuthStore } from '@/stores/authStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { formatClientAddress, formatClientFullName } from '@/utils/address';
import { copyToClipboard } from '@/utils/clipboard';
import { downloadPdfFromLines } from '@/utils/pdf';
import { buildQuotePlainText, calculateQuoteTotals, createEntityId, duplicateQuoteInput, formatQuoteDate, generateQuoteReference, getQuotePlatformLabel, getQuoteValidityDate, getTodayQuoteDate, parseQuoteDate } from '@/utils/quote';
import { computeVatRateForClient, getVatExplanation } from '@/utils/vat';

type QuoteDraft = QuoteInput;

const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();
const authStore = useAuthStore();
const toast = useToast();
const clientDialogVisible = ref(false);
const mobileEditorVisible = ref(false);
const isCompactQuotesView = ref(false);
const quoteSearch = ref('');
const quoteFilterClientId = ref('');
const quoteFilterDate = ref<Date | null>(null);
const lastAutoEmailDraft = ref('');
const unsavedAttention = ref(false);

const aiLoading = reactive({ summary: false });
let unsavedAttentionTimeout: ReturnType<typeof setTimeout> | null = null;

const syncCompactMode = () => {
  isCompactQuotesView.value = window.innerWidth < 1024;
};

const createDraft = (): QuoteDraft => ({
  clientId: '',
  title: '',
  quoteDate: getTodayQuoteDate(),
  quoteRef: generateQuoteReference(''),
  platform: '',
  customPlatformLabel: '',
  language: 'fr',
  clientName: '',
  clientAddress: '',
  clientWebsite: '',
  vatRate: 21,
  projectSummary: '',
  emailDraft: '',
  emailSubject: '',
  emailBody: '',
  basePrice: 0,
  discountType: 'percent',
  discountValue: 0,
  sections: createDefaultQuoteSections('', 'fr'),
  conditions: createDefaultQuoteConditions('', 'fr'),
  addons: createAddonPresets('fr'),
  status: 'draft',
});

const buildStandardQuoteEmail = (payload: {
  language: QuoteLanguage;
  clientName: string;
  title: string;
  quoteRef: string;
}): { subject: string; body: string } => {
  const clientGreeting = payload.clientName || '';
  const quoteTitle = payload.title || '';
  const quoteLabel =
    quoteTitle && payload.quoteRef
      ? `${quoteTitle} (${payload.quoteRef})`
      : quoteTitle || payload.quoteRef || '';

  if (payload.language === 'en') {
    return {
      subject: quoteLabel ? `Quote proposal - ${quoteLabel}` : 'Quote proposal',
      body: `${clientGreeting ? `Hi ${clientGreeting},` : 'Hi,'}

Please find attached the quote${quoteTitle ? ` for ${quoteTitle}` : ''}.

If everything looks good to you, you can simply confirm by replying to this email and I will take care of the next steps. If you would like to adjust anything, I can of course update the quote accordingly.

Kind regards,`,
    };
  }

  if (payload.language === 'es') {
    return {
      subject: quoteLabel ? `Propuesta de presupuesto - ${quoteLabel}` : 'Propuesta de presupuesto',
      body: `${clientGreeting ? `Hola ${clientGreeting},` : 'Hola,'}

Te adjunto el presupuesto${quoteTitle ? ` para ${quoteTitle}` : ''}.

Si todo te encaja, puedes confirmármelo respondiendo a este correo y me encargaré de los siguientes pasos. Si quieres ajustar algún punto, por supuesto puedo actualizar el presupuesto.

Un saludo,`,
    };
  }

  return {
    subject: quoteLabel ? `Proposition de devis - ${quoteLabel}` : 'Proposition de devis',
    body: `${clientGreeting ? `Bonjour ${clientGreeting},` : 'Bonjour,'}

Vous trouverez ci-joint le devis${quoteTitle ? ` pour ${quoteTitle}` : ''}.

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

const splitLegacyEmailDraft = (emailDraft: string): { subject: string; body: string } => {
  const trimmed = emailDraft.trim();
  if (!trimmed) return { subject: '', body: '' };

  const [firstLine, ...rest] = trimmed.split('\n');
  const subjectMatch = firstLine.match(/^(Subject|Objet|Asunto)\s*:\s*(.+)$/i);
  if (!subjectMatch) return { subject: '', body: trimmed };

  return {
    subject: subjectMatch[2]?.trim() || '',
    body: rest.join('\n').trim(),
  };
};

const composeLegacyEmailDraft = (subject: string, body: string, language: QuoteLanguage): string => {
  const prefix = language === 'en' ? 'Subject' : language === 'es' ? 'Asunto' : 'Objet';
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
      text: chunk.replace(/^[•\-]\s*/, ''),
      subItems: [],
    }));

const cloneConditionItems = (items: QuoteConditionItem[] = []): QuoteConditionItem[] =>
  items.map((item) => ({
    id: item.id || createEntityId(),
    text: item.text || '',
    subItems: (item.subItems || []).map((subItem) => ({
      id: subItem.id || createEntityId(),
      text: subItem.text || '',
    })),
  }));

const normalizeConditionItems = (condition: QuoteCondition): QuoteConditionItem[] => {
  if (condition.items?.length) return cloneConditionItems(condition.items);
  return buildConditionItemsFromBody(condition.body || '');
};

const normalizeAddonItems = (addon: QuoteAddon): QuoteConditionItem[] => {
  if (addon.items?.length) return cloneConditionItems(addon.items);
  return buildConditionItemsFromBody(addon.description || '');
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
  basePrice: draft.basePrice,
  discountType: draft.discountType,
  discountValue: draft.discountValue,
  status: draft.status,
  sections: draft.sections.map((section) => ({
    title: section.title,
    description: section.description,
    price: section.price,
    subSections: (section.subSections || []).map((subSection) => ({
      title: subSection.title,
      body: subSection.body,
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
  addons: draft.addons.map((addon) => ({
    title: addon.title,
    description: addon.description,
    items: normalizeAddonItems(addon).map((item) => ({
      text: item.text,
      subItems: item.subItems.map((subItem) => ({ text: subItem.text })),
    })),
    price: addon.price,
  })),
});

const totals = computed(() => calculateQuoteTotals(form.basePrice, form.addons, form.vatRate, form.discountType, form.discountValue));
const quoteDateModel = computed(() => (form.quoteDate ? parseQuoteDate(form.quoteDate) : null));
const validUntil = computed(() => formatQuoteDate(getQuoteValidityDate(form.quoteDate)));
const selectedClient = computed(() => clientsStore.clients.find((entry) => entry.id === form.clientId) || null);
const vatExplanation = computed(() => getVatExplanation(selectedClient.value, authStore.userProfile));
const baselineDraft = computed<QuoteDraft>(() => {
  const current = quotesStore.selectedQuote;
  if (!current) return createDraft();

  return {
    clientId: current.clientId || '',
    title: current.title || '',
    quoteDate: current.quoteDate || getTodayQuoteDate(),
    quoteRef: current.quoteRef,
    platform: current.platform,
    customPlatformLabel: current.customPlatformLabel || '',
    language: current.language,
    clientName: current.clientName,
    clientAddress: current.clientAddress,
    clientWebsite: current.clientWebsite,
    vatRate: current.vatRate,
    projectSummary: current.projectSummary,
    emailDraft: current.emailDraft,
    emailSubject: current.emailSubject || '',
    emailBody: current.emailBody || '',
    basePrice: current.basePrice || 0,
    discountType: current.discountType || 'percent',
    discountValue: current.discountValue || 0,
    sections: current.sections.map((section) => ({
      ...section,
      subSections: (section.subSections || []).map((subSection) => ({ ...subSection })),
    })),
    conditions: current.conditions.map((condition) => ({
      ...condition,
      items: normalizeConditionItems(condition),
    })),
    addons: current.addons.map((addon) => ({
      ...addon,
      items: normalizeAddonItems(addon),
    })),
    status: current.status,
  };
});
const hasUnsavedChanges = computed(
  () => JSON.stringify(normalizeDraft(form)) !== JSON.stringify(normalizeDraft(baselineDraft.value)),
);
const filteredQuotes = computed(() => {
  const query = quoteSearch.value.trim().toLowerCase();
  const clientId = quoteFilterClientId.value;
  const filterDate = quoteFilterDate.value
    ? `${quoteFilterDate.value.getFullYear()}-${`${quoteFilterDate.value.getMonth() + 1}`.padStart(2, '0')}-${`${quoteFilterDate.value.getDate()}`.padStart(2, '0')}`
    : '';

  return quotesStore.quotes.filter((quote) => {
    if (clientId && quote.clientId !== clientId) return false;
    if (filterDate && quote.quoteDate !== filterDate) return false;
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
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
});

const quoteId = computed(() => {
  const current = quotesStore.selectedQuote;
  if (current && filteredQuotes.value.some((quote) => quote.id === current.id)) return current.id;
  return filteredQuotes.value[0]?.id || null;
});

const hydrateFromQuote = (quote: Quote | null) => {
  if (!quote) {
    Object.assign(form, createDraft());
    const nextEmailDraft = buildCurrentStandardEmail();
    form.emailSubject = nextEmailDraft.subject;
    form.emailBody = nextEmailDraft.body;
    form.emailDraft = composeLegacyEmailDraft(nextEmailDraft.subject, nextEmailDraft.body, form.language);
    lastAutoEmailDraft.value = form.emailDraft;
    return;
  }

  const fallbackEmail = splitLegacyEmailDraft(quote.emailDraft || '');
  const emailSubject = quote.emailSubject || fallbackEmail.subject;
  const emailBody = quote.emailBody || fallbackEmail.body;

  Object.assign(form, {
    clientId: quote.clientId || '',
    title: quote.title || '',
    quoteDate: quote.quoteDate || getTodayQuoteDate(),
    quoteRef: quote.quoteRef,
    platform: quote.platform,
    customPlatformLabel: quote.customPlatformLabel || '',
    language: quote.language,
    clientName: quote.clientName,
    clientAddress: quote.clientAddress,
    clientWebsite: quote.clientWebsite,
    vatRate: quote.vatRate,
    projectSummary: quote.projectSummary,
    emailDraft: composeLegacyEmailDraft(emailSubject, emailBody, quote.language),
    emailSubject,
    emailBody,
    basePrice: quote.basePrice || 0,
    discountType: quote.discountType || 'percent',
    discountValue: quote.discountValue || 0,
    sections: quote.sections.map((section) => ({
      ...section,
      subSections: (section.subSections || []).map((subSection) => ({ ...subSection })),
    })),
    conditions: quote.conditions.map((condition) => ({
      ...condition,
      items: normalizeConditionItems(condition),
    })),
    addons: quote.addons.map((addon) => ({
      ...addon,
      items: normalizeAddonItems(addon),
    })),
    status: quote.status,
  });
  lastAutoEmailDraft.value = form.emailDraft || '';
};

onMounted(async () => {
  syncCompactMode();
  window.addEventListener('resize', syncCompactMode);
  await Promise.all([quotesStore.fetchQuotes(), clientsStore.fetchClients()]);
  hydrateFromQuote(quotesStore.selectedQuote);
});

onUnmounted(() => {
  window.removeEventListener('resize', syncCompactMode);
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
  () => [form.clientName, form.platform, form.language, form.quoteDate] as const,
  () => {
    form.quoteRef = generateQuoteReference(form.clientName, parseQuoteDate(form.quoteDate));
  },
  { immediate: true },
);

watch(
  () => [form.language, form.clientName, form.title, form.quoteRef] as const,
  () => {
    const nextEmailDraft = buildCurrentStandardEmail();
    const nextLegacy = composeLegacyEmailDraft(nextEmailDraft.subject, nextEmailDraft.body, form.language);
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
    const client = clientsStore.clients.find((entry) => entry.id === clientId);
    if (!client) {
      form.clientName = '';
      form.clientAddress = '';
      form.clientWebsite = '';
      form.vatRate = 21;
      form.conditions = createDefaultQuoteConditions(form.platform, form.language, '');
      return;
    }
    form.clientName = formatClientFullName(client);
    form.clientAddress = formatClientAddress(client);
    form.clientWebsite = client.website || '';
    form.language = client.language;
    form.vatRate = computeVatRateForClient(client, authStore.userProfile);
    form.conditions = createDefaultQuoteConditions(form.platform, client.language, client.country);
    form.sections = createDefaultQuoteSections(form.platform, client.language);
  },
);

watch(
  () => [form.platform, form.language] as const,
  ([platform, language], [oldPlatform, oldLanguage]) => {
    if (platform === oldPlatform && language === oldLanguage) return;
    if (platform !== 'other') form.customPlatformLabel = '';
    form.sections = createDefaultQuoteSections(platform, language);
    form.conditions = createDefaultQuoteConditions(platform, language, selectedClient.value?.country || '');
  },
);

const updateSection = (id: string, field: 'title' | 'description', value: string | number) => {
  const section = form.sections.find((entry) => entry.id === id);
  if (section) (section[field] as string | number) = value;
};

const updateBasePrice = (value: number) => {
  form.basePrice = Number(value || 0);
};

const updateDiscountType = (value: QuoteDiscountType) => {
  form.discountType = value;
};

const updateDiscountValue = (value: number) => {
  form.discountValue = Math.max(Number(value || 0), 0);
};

const updateSectionSubsection = (sectionId: string, subsectionId: string, field: 'title' | 'body', value: string) => {
  const section = form.sections.find((entry) => entry.id === sectionId);
  const subSection = section?.subSections.find((entry) => entry.id === subsectionId);
  if (subSection) subSection[field] = value;
};

const updateCondition = (id: string, field: 'title' | 'body', value: string) => {
  const condition = form.conditions.find((entry) => entry.id === id);
  if (condition) condition[field] = value;
};

const addConditionItem = (conditionId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = [...(condition.items || []), { id: createEntityId(), text: '', subItems: [] }];
};

const updateConditionItem = (conditionId: string, itemId: string, value: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeConditionItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = condition.items.filter((entry) => entry.id !== itemId);
};

const moveConditionItem = (conditionId: string, draggedId: string, targetId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = condition.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
  const next = [...condition.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  condition.items = next;
};

const nestConditionItemUnderItem = (conditionId: string, draggedId: string, targetId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = condition.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = condition.items.splice(draggedIndex, 1);
  targetItem.subItems = [...(targetItem.subItems || []), { id: createEntityId(), text: dragged.text }];
};

const addConditionSubItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [...(item.subItems || []), { id: createEntityId(), text: '' }];
};

const updateConditionSubItem = (conditionId: string, itemId: string, subItemId: string, value: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeConditionSubItem = (conditionId: string, itemId: string, subItemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveConditionSubItem = (conditionId: string, itemId: string, draggedId: string, targetId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex((entry) => entry.id === draggedId);
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveConditionSubItemToItem = (conditionId: string, fromItemId: string, subItemId: string, targetItemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceItem = condition.items.find((entry) => entry.id === fromItemId);
  const targetItem = condition.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex((entry) => entry.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [...(targetItem.subItems || []), { id: createEntityId(), text: subItem.text }];
};

const promoteConditionSubItemToItem = (conditionId: string, fromItemId: string, subItemId: string, targetId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceIndex = condition.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = condition.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = condition.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex((entry) => entry.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = { id: createEntityId(), text: subItem.text, subItems: [] };
  condition.items.splice(targetIndex, 0, promoted);
};

const updateAddon = (
  id: string,
  field: 'title' | 'description' | 'price',
  value: string | number,
) => {
  const addon = form.addons.find((entry) => entry.id === id);
  if (addon) (addon[field] as string | number) = value;
};

const addAddonItem = (addonId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  addon.items = [...(addon.items || []), { id: createEntityId(), text: '', subItems: [] }];
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

const moveAddonItem = (addonId: string, draggedId: string, targetId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
  const next = [...addon.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  addon.items = next;
};

const nestAddonItemUnderItem = (addonId: string, draggedId: string, targetId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = addon.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = addon.items.splice(draggedIndex, 1);
  targetItem.subItems = [...(targetItem.subItems || []), { id: createEntityId(), text: dragged.text }];
};

const addAddonSubItem = (addonId: string, itemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [...(item.subItems || []), { id: createEntityId(), text: '' }];
};

const updateAddonSubItem = (addonId: string, itemId: string, subItemId: string, value: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeAddonSubItem = (addonId: string, itemId: string, subItemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveAddonSubItem = (addonId: string, itemId: string, draggedId: string, targetId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex((entry) => entry.id === draggedId);
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveAddonSubItemToItem = (addonId: string, fromItemId: string, subItemId: string, targetItemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceItem = addon.items.find((entry) => entry.id === fromItemId);
  const targetItem = addon.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex((entry) => entry.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [...(targetItem.subItems || []), { id: createEntityId(), text: subItem.text }];
};

const promoteAddonSubItemToItem = (addonId: string, fromItemId: string, subItemId: string, targetId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceIndex = addon.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = addon.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex((entry) => entry.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = { id: createEntityId(), text: subItem.text, subItems: [] };
  addon.items.splice(targetIndex, 0, promoted);
};

const addSection = () => {
  form.sections.push({ id: createEntityId(), title: 'Nouvelle ligne', description: '', price: 0, subSections: [] });
};

const addSectionSubsection = (sectionId: string) => {
  const section = form.sections.find((entry) => entry.id === sectionId);
  if (!section) return;
  section.subSections.push({ id: createEntityId(), title: 'Nouvelle sous-section', body: '' });
};

const addCondition = () => {
  form.conditions.push({ id: createEntityId(), title: 'Nouvelle condition', body: '', items: [] });
};

const addAddonPreset = () => {
  form.addons.push(createBlankAddon());
};

const moveAddon = (draggedId: string, targetId: string) => {
  const draggedIndex = form.addons.findIndex((addon) => addon.id === draggedId);
  const targetIndex = form.addons.findIndex((addon) => addon.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

  const next = [...form.addons];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.addons = next;
};

const duplicateQuote = async (id: string) => {
  if (hasUnsavedChanges.value) {
    notifyUnsavedBlockedAction();
    return;
  }
  const source = quotesStore.quotes.find((quote) => quote.id === id);
  if (!source) return;

  const payload = duplicateQuoteInput(source);
  const quoteTotals = calculateQuoteTotals(payload.basePrice || 0, payload.addons, payload.vatRate, payload.discountType || 'percent', payload.discountValue || 0);
  const subtotal = quoteTotals.subtotal;
  const totalWithVat = quoteTotals.totalWithVat;

  await quotesStore.saveQuote(null, {
    ...payload,
    subtotal,
    totalWithVat,
  });
  if (isCompactQuotesView.value) mobileEditorVisible.value = true;
  toast.add({ severity: 'success', summary: 'Devis dupliqué', detail: 'Un nouveau brouillon a été créé à partir du devis existant.', life: 2500 });
};

const saveQuote = async () => {
  form.emailDraft = composeLegacyEmailDraft(form.emailSubject, form.emailBody, form.language);
  const payload: QuoteInput & Pick<Quote, 'subtotal' | 'totalWithVat'> = {
    ...form,
    subtotal: totals.value.subtotal,
    totalWithVat: totals.value.totalWithVat,
  };

  await quotesStore.saveQuote(quoteId.value, payload);
  toast.add({ severity: 'success', summary: 'Devis sauvegardé', detail: 'Le devis a été enregistré.', life: 2500 });
};

const generateSummary = async () => {
  aiLoading.summary = true;
  try {
    form.projectSummary = await generateQuoteProjectDescription({
      platform: getQuotePlatformLabel(form.platform, form.customPlatformLabel),
      language: form.language,
      clientName: form.clientName,
      website: form.clientWebsite,
      goals: form.sections.map((section) => section.title).join(', '),
    });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'IA indisponible', detail: 'Impossible de générer la description.', life: 2500 });
  } finally {
    aiLoading.summary = false;
  }
};

const downloadPdf = () => {
  const quote: Quote = {
    id: quoteId.value || createEntityId(),
    userId: 'local',
    ...form,
    subtotal: totals.value.subtotal,
    totalWithVat: totals.value.totalWithVat,
    createdAt: new Date().toISOString(),
  };

  downloadPdfFromLines(`${form.quoteRef}.pdf`, buildQuotePlainText(quote));
  toast.add({ severity: 'secondary', summary: 'PDF généré', detail: 'Le devis a été exporté en PDF.', life: 2000 });
};

const deleteQuote = async () => {
  if (!quoteId.value) {
    hydrateFromQuote(null);
    return;
  }

  await quotesStore.deleteQuote(quoteId.value);
  hydrateFromQuote(quotesStore.selectedQuote);
  if (isCompactQuotesView.value) mobileEditorVisible.value = false;
  toast.add({ severity: 'secondary', summary: 'Devis supprimé', detail: 'Le brouillon a été retiré.', life: 2000 });
};

const copyEmailSubject = async () => {
  const success = await copyToClipboard(form.emailSubject);
  if (success) {
    toast.add({ severity: 'secondary', summary: 'Objet copié', detail: 'L’objet a été ajouté au presse-papiers.', life: 1800 });
  }
};

const copyEmailBody = async () => {
  const success = await copyToClipboard(form.emailBody);
  if (success) {
    toast.add({ severity: 'secondary', summary: 'Contenu copié', detail: 'Le contenu a été ajouté au presse-papiers.', life: 1800 });
  }
};

const handleCreateClientFromQuote = async (payload: ClientInput, id: string | null) => {
  const client = await clientsStore.saveClient(id, payload);
  clientDialogVisible.value = false;
  form.clientId = client.id;
  toast.add({ severity: 'success', summary: 'Client créé', detail: 'Le client est prêt pour le devis.', life: 2200 });
};

const updateQuoteDate = (value: Date | null) => {
  if (!value) return;
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  form.quoteDate = `${year}-${month}-${day}`;
};

const discardChanges = () => {
  hydrateFromQuote(quotesStore.selectedQuote);
  toast.add({ severity: 'secondary', summary: 'Modifications annulées', detail: 'Le devis a été réinitialisé.', life: 2200 });
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
    severity: 'warn',
    summary: 'Sauvegarde requise',
    detail: 'Enregistre ou annule d’abord les modifications en cours.',
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
    <div class="sticky top-0 z-20 bg-surface-light/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-surface-light/80">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Devis & proposition client</h1>

        <div
          v-if="hasUnsavedChanges"
          class="hidden lg:flex items-center gap-2 rounded-full border border-surface-dark/10 bg-white/95 px-3 py-2 shadow-sm"
          :class="{ 'quotes-unsaved-nudge': unsavedAttention }"
        >
          <div class="flex items-center gap-2 min-w-0 pr-1">
            <span class="material-symbols-outlined text-base text-surface-dark/60">pending_actions</span>
            <span class="truncate text-sm font-medium text-surface-dark/75">Unsaved changes</span>
          </div>
          <Button severity="secondary" size="small" @click="discardChanges">Discard</Button>
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
        @create="openCreateQuote"
        @duplicate="duplicateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date="quoteFilterDate = $event"
      />
    </div>

    <div class="hidden lg:grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
      <QuoteListPanel
        :quotes="filteredQuotes"
        :selected-quote-id="quoteId"
        :clients="clientsStore.clients"
        :search="quoteSearch"
        :filter-client-id="quoteFilterClientId"
        :filter-date="quoteFilterDate"
        @create="openCreateQuote"
        @duplicate="duplicateQuote"
        @select="openQuote"
        @update:search="quoteSearch = $event"
        @update:filter-client-id="quoteFilterClientId = $event"
        @update:filter-date="quoteFilterDate = $event"
      />

      <div class="flex flex-col gap-6">
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
          :client-vat-label="selectedClient ? (selectedClient.isVatRegistered ? selectedClient.vatNumber || 'Client assujetti à la TVA' : 'Client non assujetti à la TVA') : 'Aucun client sélectionné'"
          :platform="form.platform"
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :status="form.status"
          :vat-rate="form.vatRate"
          :base-price="form.basePrice"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          :sections="form.sections"
          :conditions="form.conditions"
          :addons="form.addons"
          :clients="clientsStore.clients"
          :addons-total="totals.addonsTotal"
          :discount-amount="totals.discountAmount"
          :subtotal="totals.subtotal"
          :vat-amount="totals.vatAmount"
          :total-with-vat="totals.totalWithVat"
          :vat-explanation="vatExplanation"
          :ai-loading="aiLoading.summary"
          @update:title="form.title = $event"
          @update:quote-date="updateQuoteDate"
          @update:client-id="form.clientId = $event"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:status="form.status = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:base-price="updateBasePrice"
          @update:discount-type="updateDiscountType"
          @update:discount-value="updateDiscountValue"
          @update:project-summary="form.projectSummary = $event"
          @create-client="clientDialogVisible = true"
          @add-section="addSection"
          @update-section="updateSection($event.id, $event.field, $event.value)"
          @remove-section="form.sections = form.sections.filter((section) => section.id !== $event)"
          @add-section-subsection="addSectionSubsection"
          @update-section-subsection="updateSectionSubsection($event.sectionId, $event.subsectionId, $event.field, $event.value)"
          @remove-section-subsection="
            form.sections = form.sections.map((section) =>
              section.id !== $event.sectionId
                ? section
                : { ...section, subSections: section.subSections.filter((subSection) => subSection.id !== $event.subsectionId) },
            )
          "
          @add-condition="addCondition"
          @update-condition="updateCondition($event.id, $event.field, $event.value)"
          @remove-condition="form.conditions = form.conditions.filter((condition) => condition.id !== $event)"
          @add-condition-item="addConditionItem"
          @update-condition-item="updateConditionItem($event.conditionId, $event.itemId, $event.value)"
          @remove-condition-item="removeConditionItem($event.conditionId, $event.itemId)"
          @move-condition-item="moveConditionItem($event.conditionId, $event.draggedId, $event.targetId)"
          @nest-condition-item-under-item="nestConditionItemUnderItem($event.conditionId, $event.draggedId, $event.targetId)"
          @add-condition-sub-item="addConditionSubItem($event.conditionId, $event.itemId)"
          @update-condition-sub-item="updateConditionSubItem($event.conditionId, $event.itemId, $event.subItemId, $event.value)"
          @remove-condition-sub-item="removeConditionSubItem($event.conditionId, $event.itemId, $event.subItemId)"
          @move-condition-sub-item="moveConditionSubItem($event.conditionId, $event.itemId, $event.draggedId, $event.targetId)"
          @move-condition-sub-item-to-item="moveConditionSubItemToItem($event.conditionId, $event.fromItemId, $event.subItemId, $event.targetItemId)"
          @promote-condition-sub-item-to-item="promoteConditionSubItemToItem($event.conditionId, $event.fromItemId, $event.subItemId, $event.targetId)"
          @add-addon-preset="addAddonPreset"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="form.addons = form.addons.filter((addon) => addon.id !== $event)"
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @add-addon-item="addAddonItem"
          @update-addon-item="updateAddonItem($event.addonId, $event.itemId, $event.value)"
          @remove-addon-item="removeAddonItem($event.addonId, $event.itemId)"
          @move-addon-item="moveAddonItem($event.addonId, $event.draggedId, $event.targetId)"
          @nest-addon-item-under-item="nestAddonItemUnderItem($event.addonId, $event.draggedId, $event.targetId)"
          @add-addon-sub-item="addAddonSubItem($event.addonId, $event.itemId)"
          @update-addon-sub-item="updateAddonSubItem($event.addonId, $event.itemId, $event.subItemId, $event.value)"
          @remove-addon-sub-item="removeAddonSubItem($event.addonId, $event.itemId, $event.subItemId)"
          @move-addon-sub-item="moveAddonSubItem($event.addonId, $event.itemId, $event.draggedId, $event.targetId)"
          @move-addon-sub-item-to-item="moveAddonSubItemToItem($event.addonId, $event.fromItemId, $event.subItemId, $event.targetItemId)"
          @promote-addon-sub-item-to-item="promoteAddonSubItemToItem($event.addonId, $event.fromItemId, $event.subItemId, $event.targetId)"
          @generate-summary="generateSummary"
        />

        <QuoteOutputPanel
          :language="form.language"
          :email-subject="form.emailSubject"
          :email-body="form.emailBody"
          @update:email-subject="
            form.emailSubject = $event;
            form.emailDraft = composeLegacyEmailDraft(form.emailSubject, form.emailBody, form.language);
          "
          @update:email-body="
            form.emailBody = $event;
            form.emailDraft = composeLegacyEmailDraft(form.emailSubject, form.emailBody, form.language);
          "
          @copy-email-subject="copyEmailSubject"
          @copy-email-body="copyEmailBody"
          @download-pdf="downloadPdf"
          @save="saveQuote"
          @delete="deleteQuote"
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
        <div class="sticky top-0 z-10 border-b border-surface-dark/8 bg-surface-light/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-light/80">
          <div class="flex items-center justify-between gap-3">
            <Button text severity="secondary" @click="closeMobileEditor">
              <template #icon><span class="material-symbols-outlined text-lg">arrow_back</span></template>
              Retour à la liste
            </Button>
            <p class="min-w-0 truncate text-sm font-semibold text-surface-dark">
              {{ form.title || form.clientName || 'Nouveau devis' }}
            </p>
          </div>
          <div
            v-if="hasUnsavedChanges"
            class="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-surface-dark/10 bg-white px-3 py-2 shadow-sm"
            :class="{ 'quotes-unsaved-nudge': unsavedAttention }"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-base text-surface-dark/60">pending_actions</span>
              <span class="truncate text-sm font-medium text-surface-dark/75">Unsaved changes</span>
            </div>
            <div class="flex items-center gap-2">
              <Button severity="secondary" size="small" @click="discardChanges">Discard</Button>
              <Button size="small" @click="saveQuote">Save</Button>
            </div>
          </div>
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
          :client-vat-label="selectedClient ? (selectedClient.isVatRegistered ? selectedClient.vatNumber || 'Client assujetti à la TVA' : 'Client non assujetti à la TVA') : 'Aucun client sélectionné'"
          :platform="form.platform"
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :status="form.status"
          :vat-rate="form.vatRate"
          :base-price="form.basePrice"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          :sections="form.sections"
          :conditions="form.conditions"
          :addons="form.addons"
          :clients="clientsStore.clients"
          :addons-total="totals.addonsTotal"
          :discount-amount="totals.discountAmount"
          :subtotal="totals.subtotal"
          :vat-amount="totals.vatAmount"
          :total-with-vat="totals.totalWithVat"
          :vat-explanation="vatExplanation"
          :ai-loading="aiLoading.summary"
          @update:title="form.title = $event"
          @update:quote-date="updateQuoteDate"
          @update:client-id="form.clientId = $event"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:status="form.status = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:base-price="updateBasePrice"
          @update:discount-type="updateDiscountType"
          @update:discount-value="updateDiscountValue"
          @update:project-summary="form.projectSummary = $event"
          @create-client="clientDialogVisible = true"
          @add-section="addSection"
          @update-section="updateSection($event.id, $event.field, $event.value)"
          @remove-section="form.sections = form.sections.filter((section) => section.id !== $event)"
          @add-section-subsection="addSectionSubsection"
          @update-section-subsection="updateSectionSubsection($event.sectionId, $event.subsectionId, $event.field, $event.value)"
          @remove-section-subsection="
            form.sections = form.sections.map((section) =>
              section.id !== $event.sectionId
                ? section
                : { ...section, subSections: section.subSections.filter((subSection) => subSection.id !== $event.subsectionId) },
            )
          "
          @add-condition="addCondition"
          @update-condition="updateCondition($event.id, $event.field, $event.value)"
          @remove-condition="form.conditions = form.conditions.filter((condition) => condition.id !== $event)"
          @add-condition-item="addConditionItem"
          @update-condition-item="updateConditionItem($event.conditionId, $event.itemId, $event.value)"
          @remove-condition-item="removeConditionItem($event.conditionId, $event.itemId)"
          @move-condition-item="moveConditionItem($event.conditionId, $event.draggedId, $event.targetId)"
          @nest-condition-item-under-item="nestConditionItemUnderItem($event.conditionId, $event.draggedId, $event.targetId)"
          @add-condition-sub-item="addConditionSubItem($event.conditionId, $event.itemId)"
          @update-condition-sub-item="updateConditionSubItem($event.conditionId, $event.itemId, $event.subItemId, $event.value)"
          @remove-condition-sub-item="removeConditionSubItem($event.conditionId, $event.itemId, $event.subItemId)"
          @move-condition-sub-item="moveConditionSubItem($event.conditionId, $event.itemId, $event.draggedId, $event.targetId)"
          @move-condition-sub-item-to-item="moveConditionSubItemToItem($event.conditionId, $event.fromItemId, $event.subItemId, $event.targetItemId)"
          @promote-condition-sub-item-to-item="promoteConditionSubItemToItem($event.conditionId, $event.fromItemId, $event.subItemId, $event.targetId)"
          @add-addon-preset="addAddonPreset"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="form.addons = form.addons.filter((addon) => addon.id !== $event)"
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @add-addon-item="addAddonItem"
          @update-addon-item="updateAddonItem($event.addonId, $event.itemId, $event.value)"
          @remove-addon-item="removeAddonItem($event.addonId, $event.itemId)"
          @move-addon-item="moveAddonItem($event.addonId, $event.draggedId, $event.targetId)"
          @nest-addon-item-under-item="nestAddonItemUnderItem($event.addonId, $event.draggedId, $event.targetId)"
          @add-addon-sub-item="addAddonSubItem($event.addonId, $event.itemId)"
          @update-addon-sub-item="updateAddonSubItem($event.addonId, $event.itemId, $event.subItemId, $event.value)"
          @remove-addon-sub-item="removeAddonSubItem($event.addonId, $event.itemId, $event.subItemId)"
          @move-addon-sub-item="moveAddonSubItem($event.addonId, $event.itemId, $event.draggedId, $event.targetId)"
          @move-addon-sub-item-to-item="moveAddonSubItemToItem($event.addonId, $event.fromItemId, $event.subItemId, $event.targetItemId)"
          @promote-addon-sub-item-to-item="promoteAddonSubItemToItem($event.addonId, $event.fromItemId, $event.subItemId, $event.targetId)"
          @generate-summary="generateSummary"
        />

        <QuoteOutputPanel
          :language="form.language"
          :email-subject="form.emailSubject"
          :email-body="form.emailBody"
          @update:email-subject="
            form.emailSubject = $event;
            form.emailDraft = composeLegacyEmailDraft(form.emailSubject, form.emailBody, form.language);
          "
          @update:email-body="
            form.emailBody = $event;
            form.emailDraft = composeLegacyEmailDraft(form.emailSubject, form.emailBody, form.language);
          "
          @copy-email-subject="copyEmailSubject"
          @copy-email-body="copyEmailBody"
          @download-pdf="downloadPdf"
          @save="saveQuote"
          @delete="deleteQuote"
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
