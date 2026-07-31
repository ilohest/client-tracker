import { z } from 'zod';

export const USER_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#f43f5e',
  '#64748b',
];

export const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export const successSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const authCredentialsSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit faire 6 caractères minimum'),
});

export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  contactEmail: z.string().optional().default(''),
  role: z.enum(['user', 'admin']).default('user'),
  displayName: z.string().optional().nullable(),
  jobTitle: z.string().optional().default(''),
  hourlyRate: z.number().optional().default(0),
  photoURL: z.string().optional().nullable(),
  color: z.string().default(USER_COLORS[7]),
  address: z.string().optional().default(''),
  billingStreet: z.string().optional().default(''),
  billingStreetNumber: z.string().optional().default(''),
  billingPostalCode: z.string().optional().default(''),
  billingCity: z.string().optional().default(''),
  website: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  logoPath: z.string().optional().default(''),
  quotePdfTextColor: z.string().optional().default('#23262f'),
  quotePdfTitleColor: z.string().optional().default('#23262f'),
  quotePdfAccentColor: z.string().optional().default('#14161f'),
  quotePdfHeadingFont: z.string().optional().default('Fraunces'),
  quotePdfHeadingFontVariant: z.string().optional().default('600'),
  quotePdfHeadingFontGoogleFamily: z.string().optional().default('Fraunces:opsz,wght@9..144,600'),
  quotePdfBodyFont: z.string().optional().default('Inter'),
  quotePdfBodyFontVariant: z.string().optional().default('regular'),
  quotePdfBodyFontGoogleFamily: z.string().optional().default('Inter:wght@400'),
  billingCountry: z.string().optional().default(''),
  vatNumber: z.string().optional().default(''),
  createdAt: z.union([z.string(), z.date(), z.any()]).optional(),
  lastLoginAt: z.union([z.string(), z.date(), z.any()]).optional(),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
  color: z.string().optional(),
});

export const appUserSchema = z.object({
  uid: z.string(),
  email: z.string().optional().nullable(),
  displayName: z.string().optional().or(z.literal('')),
  createdAt: z.string(),
  lastSignInTime: z.string(),
  disabled: z.boolean(),
  role: z.enum(['user', 'admin']).optional().default('user'),
  color: z.string().optional(),
});

export const createNoteSchema = z.object({
  content: z
    .string()
    .min(1, 'Le contenu ne peut pas être vide')
    .max(500, 'La note est trop longue (max 500 caractères)'),
  isPrivate: z.boolean().default(false).optional(),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1),
  isPrivate: z.boolean().optional(),
});

export const noteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string(),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const aiGeneratedNoteSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  priorityScore: z.number(),
});

export const announcementSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  date: z.string(),
  author: z.string(),
});

export const createAnnouncementSchema = z.object({
  content: z.string().min(1),
});

export const clientPlatformSchema = z.enum([
  '',
  'shopify',
  'wordpress',
  'webflow',
  'squarespace',
  'custom',
  'other',
]);

export const quoteLanguageSchema = z.enum(['fr', 'en', 'es']);
export const vatRateSchema = z.union([z.literal(0), z.literal(21)]);
export const clientStageSchema = z.enum([
  'prospect',
  'opportunity',
  'active',
  'recurring',
  'paused',
  'former',
]);

export const onboardingTaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'done',
]);

export const onboardingTaskCategorySchema = z.enum([
  'strategy',
  'content',
  'branding',
  'access',
  'legal',
  'delivery',
]);

export const onboardingTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: onboardingTaskCategorySchema,
  status: onboardingTaskStatusSchema,
  required: z.boolean().default(true),
});

export const clientDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  path: z.string(),
  size: z.number(),
  uploadedAt: z.union([z.string(), z.date(), z.any()]),
});

export const clientProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  onboardingTasks: z.array(onboardingTaskSchema).default([]),
});

export const clientNoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional().default(''),
});

export const clientSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  companyName: z.string().optional().default(''),
  contactEmail: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  street: z.string().optional().default(''),
  streetNumber: z.string().optional().default(''),
  postalCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  website: z.string().optional().default(''),
  country: z.string().default(''),
  isVatRegistered: z.boolean().default(false),
  vatNumber: z.string().optional().default(''),
  platform: clientPlatformSchema.default(''),
  language: quoteLanguageSchema,
  stage: clientStageSchema.default('prospect'),
  notes: z.string().optional().default(''),
  clientNotes: z.array(clientNoteSchema).default([]),
  documents: z.array(clientDocumentSchema).default([]),
  projects: z.array(clientProjectSchema).default([]),
  onboardingTasks: z.array(onboardingTaskSchema).default([]),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const clientInputSchema = clientSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Contenu d'une ligne de devis : une liste *à plat* de blocs, façon éditeur de
 * blocs (Notion/Craft). L'imbrication des listes passe par `depth`, pas par des
 * tableaux imbriqués — un seul concept à éditer, et Firestore reste content
 * (pas de tableau dans un tableau).
 */
export const quoteBlockKindSchema = z.enum([
  'paragraph',
  'bullet',
  'numbered',
  'heading',
  'table',
]);

export const quoteTableRowSchema = z.object({
  id: z.string(),
  cells: z.array(z.string()).default([]),
});

export const quoteTableSchema = z.object({
  columns: z.array(z.string()).default([]),
  rows: z.array(quoteTableRowSchema).default([]),
  hasHeader: z.boolean().default(true),
});

export const quoteBlockSchema = z.object({
  id: z.string(),
  kind: quoteBlockKindSchema.default('paragraph'),
  /** Niveau d'indentation (0 = racine). Ignoré par les blocs `table`. */
  depth: z.number().int().min(0).max(3).default(0),
  text: z.string().default(''),
  /** Renseigné uniquement quand `kind === 'table'`. */
  table: quoteTableSchema.optional(),
});

export const quoteConditionSubItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const quoteConditionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  subItems: z.array(quoteConditionSubItemSchema).default([]),
});

export const quoteSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  blocks: z.array(quoteBlockSchema).default([]),
});

/** Mise en page d'une partie : 'flow' = blocs fluides, 'framed' = cellules encadrées. */
export const quotePartDisplayStyleSchema = z.enum(['flow', 'framed']);

export const quotePartSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  displayStyle: quotePartDisplayStyleSchema.default('flow'),
  price: z.number().default(0),
  optional: z.boolean().default(false),
  includeInInvestment: z.boolean().default(true),
  priceNote: z.string().default(''),
  sections: z.array(quoteSectionSchema).default([]),
});

export const quoteConditionSchema = z.object({
  id: z.string(),
  commonConditionId: z.string().optional(),
  title: z.string(),
  tag: z.string().optional(),
  body: z.string().default(''),
  items: z.array(quoteConditionItemSchema).default([]),
});

export const quoteAddonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(quoteConditionItemSchema).default([]),
  price: z.number(),
  unitLabel: z.string().default(''),
  enabled: z.boolean().default(true),
});

/** Section rédactionnelle libre, placée où l'on veut dans le document. */
export const quoteCustomSectionSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  /** Lignes structurées, comme dans la portée du projet. */
  sections: z.array(quoteSectionSchema).default([]),
  displayStyle: quotePartDisplayStyleSchema.default('flow'),
  /** Ancien format conservé pour compatibilité avec les devis existants. */
  content: z.string().default(''),
});

export const quoteInvestmentLineModeSchema = z.enum(['percent', 'fixed']);

/**
 * Ligne libre du tableau « Investissement ». `mode: 'fixed'` = montant HT ;
 * `mode: 'percent'` = pourcentage du Prix global HT (`investmentAmount`) — pratique
 * pour répartir un total sans erreur d'addition.
 */
export const quoteInvestmentLineSchema = z.object({
  id: z.string(),
  label: z.string().default(''),
  mode: quoteInvestmentLineModeSchema.default('fixed'),
  value: z.number().default(0),
  note: z.string().default(''),
});

export const quotePaymentScheduleStepSchema = z.object({
  id: z.string(),
  label: z.string().default(''),
  mode: z.enum(['percent', 'fixed']).default('percent'),
  value: z.number().default(0),
});

export const quoteTemplateLocalizedContentSchema = z.object({
  projectSummary: z.string().default(''),
  // Mail d'envoi standard (base commune) — placeholders : {client} prénom, {titre}, {projet}, {ref}.
  emailSubject: z.string().default(''),
  emailBody: z.string().default(''),
  parts: z.array(quotePartSchema).default([]),
  conditions: z.array(quoteConditionSchema).default([]),
  roadmap: z.array(quoteConditionSchema).default([]),
  acceptance: z.array(quoteConditionSchema).default([]),
  principles: z.array(quoteConditionSchema).default([]),
  addons: z.array(quoteAddonSchema).default([]),
  paymentSchedule: z.array(quotePaymentScheduleStepSchema).default([]),
});

export const quoteTemplateLocalizedContentMapSchema = z.object({
  fr: quoteTemplateLocalizedContentSchema,
  en: quoteTemplateLocalizedContentSchema,
  es: quoteTemplateLocalizedContentSchema,
});

export const quoteStatusSchema = z.enum([
  'draft', // brouillon, éditable librement
  'finalized', // finalisé/verrouillé (prêt, PDF généré) — ne devrait plus changer
  'sent', // envoyé au client
  'accepted', // approuvé par le client
  'refused', // refusé par le client
  'revision_requested', // le client demande des modifications
  'superseded', // remplacé par une version plus récente
]);
export const quoteDiscountTypeSchema = z.enum(['percent', 'fixed']);

export const quoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clientId: z.string().optional().default(''),
  templateId: z.string().optional().default(''),
  title: z.string().default(''),
  projectName: z.string().optional().default(''),
  quoteDate: z.string().default(''),
  quoteRef: z.string(),
  platform: clientPlatformSchema,
  customPlatformLabel: z.string().optional().default(''),
  language: quoteLanguageSchema,
  clientName: z.string(),
  clientAddress: z.string().optional().default(''),
  clientWebsite: z.string().optional().default(''),
  vatRate: vatRateSchema,
  projectSummary: z.string().default(''),
  investmentSummary: z.string().optional().default(''),
  investmentAmount: z.number().optional().default(0),
  investmentLines: z.array(quoteInvestmentLineSchema).default([]),
  emailDraft: z.string().default(''),
  emailSubject: z.string().default(''),
  emailBody: z.string().default(''),
  discountType: quoteDiscountTypeSchema.default('percent'),
  discountValue: z.number().default(0),
  version: z.number().default(1),
  versionGroupId: z.string().default(''),
  projectId: z.string().optional(),
  parts: z.array(quotePartSchema).default([]),
  conditions: z.array(quoteConditionSchema).default([]),
  roadmap: z.array(quoteConditionSchema).default([]),
  acceptance: z.array(quoteConditionSchema).default([]),
  principles: z.array(quoteConditionSchema).default([]),
  addons: z.array(quoteAddonSchema).default([]),
  paymentSchedule: z.array(quotePaymentScheduleStepSchema).default([]),
  customSections: z.array(quoteCustomSectionSchema).default([]),
  documentOrder: z.array(z.string()).default(['scope', 'investment', 'paymentSchedule']),
  hiddenSections: z.array(z.string()).default([]),
  subtotal: z.number(),
  totalWithVat: z.number(),
  status: quoteStatusSchema.default('draft'),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const quoteInputSchema = quoteSchema.omit({
  id: true,
  userId: true,
  subtotal: true,
  totalWithVat: true,
  createdAt: true,
  updatedAt: true,
});

// 'base' = base commune protégée qui préremplit les nouveaux devis (unique, non supprimable),
// 'custom' = template créé librement par l'utilisateur.
export const quoteTemplateKindSchema = z.enum(['base', 'custom']);

export const quoteTemplateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  kind: quoteTemplateKindSchema.default('custom'),
  platform: clientPlatformSchema,
  customPlatformLabel: z.string().optional().default(''),
  language: quoteLanguageSchema,
  vatRate: vatRateSchema,
  projectSummary: z.string().default(''),
  emailSubject: z.string().default(''),
  emailBody: z.string().default(''),
  discountType: quoteDiscountTypeSchema.default('percent'),
  discountValue: z.number().default(0),
  parts: z.array(quotePartSchema).default([]),
  conditions: z.array(quoteConditionSchema).default([]),
  roadmap: z.array(quoteConditionSchema).default([]),
  acceptance: z.array(quoteConditionSchema).default([]),
  principles: z.array(quoteConditionSchema).default([]),
  addons: z.array(quoteAddonSchema).default([]),
  paymentSchedule: z.array(quotePaymentScheduleStepSchema).default([]),
  localizedContent: quoteTemplateLocalizedContentMapSchema.default({
    fr: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: [], principles: [], addons: [], paymentSchedule: [] },
    en: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: [], principles: [], addons: [], paymentSchedule: [] },
    es: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: [], principles: [], addons: [], paymentSchedule: [] },
  }),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const quoteTemplateInputSchema = quoteTemplateSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const timesheetSourceTypeSchema = z.enum(['quote', 'custom']);
export const timesheetStatusSchema = z.enum(['open', 'closed', 'archived']);
export const projectStatusSchema = z.enum([
  'proposal_accepted',
  'deposit_pending',
  'deposit_paid',
  'in_progress',
  'blocked',
  'client_review',
  'ready_to_invoice',
  'invoiced',
  'paid',
  'closed',
]);
export const projectHealthSchema = z.enum(['ok', 'watch', 'blocked']);
export const projectSourceTypeSchema = z.enum(['quote', 'custom']);

export const timesheetSessionSchema = z.object({
  id: z.string(),
  title: z.string().optional().default(''),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSeconds: z.number().default(0),
});

export const timesheetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  projectId: z.string().optional().default(''),
  sourceType: timesheetSourceTypeSchema.default('custom'),
  quoteId: z.string().optional().default(''),
  quoteRef: z.string().optional().default(''),
  clientId: z.string().optional().default(''),
  clientName: z.string().optional().default(''),
  color: z.string().default(USER_COLORS[7]),
  hourlyRate: z.number().default(0),
  fixedPriceExVat: z.number().default(0),
  projectStartDate: z.string().optional().default(''),
  status: timesheetStatusSchema.default('open'),
  totalTrackedSeconds: z.number().default(0),
  activeStartedAt: z.string().optional().default(''),
  sessions: z.array(timesheetSessionSchema).default([]),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const timesheetInputSchema = timesheetSchema.omit({
  id: true,
  userId: true,
  totalTrackedSeconds: true,
  sessions: true,
  createdAt: true,
  updatedAt: true,
});

export const projectMilestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['todo', 'done', 'blocked']).default('todo'),
  date: z.string().optional().default(''),
  kind: z.enum(['quote_accepted', 'invoice_sent', 'payment_received', 'work', 'approval', 'delivery', 'custom']).optional(),
  paymentScheduleStepId: z.string().optional(),
  paymentScheduleIndex: z.number().optional(),
  quoteId: z.string().optional(),
  addOnId: z.string().optional(),
});

export const projectNoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional().default(''),
});

export const projectSupplementSchema = z.object({
  id: z.string(),
  title: z.string(),
  amountExVat: z.number().default(0),
  createdAt: z.string(),
  description: z.string().optional().default(''),
});

export const projectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  projectNotes: z.array(projectNoteSchema).default([]),
  projectSupplements: z.array(projectSupplementSchema).default([]),
  sourceType: projectSourceTypeSchema.default('custom'),
  timesheetId: z.string().optional().default(''),
  clientId: z.string().optional().default(''),
  clientName: z.string().optional().default(''),
  color: z.string().default(USER_COLORS[7]),
  status: projectStatusSchema.default('in_progress'),
  health: projectHealthSchema.default('ok'),
  budgetExVat: z.number().default(0),
  invoicedExVat: z.number().default(0),
  paidExVat: z.number().default(0),
  billingWaivedExVat: z.number().default(0),
  hourlyRate: z.number().default(0),
  startedAt: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  closedAt: z.string().optional().default(''),
  blockedReason: z.string().optional().default(''),
  nextAction: z.string().optional().default(''),
  milestones: z.array(projectMilestoneSchema).default([]),
  createdAt: z.union([z.string(), z.date(), z.any()]),
  updatedAt: z.union([z.string(), z.date(), z.any()]).optional(),
});

export const projectInputSchema = projectSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type AppUser = z.infer<typeof appUserSchema>;
export type Note = z.infer<typeof noteSchema>;
export type CreateNoteDTO = z.infer<typeof createNoteSchema>;
export type UpdateNoteDTO = z.infer<typeof updateNoteSchema>;
export type AiGeneratedNote = z.infer<typeof aiGeneratedNoteSchema>;
export type Announcement = z.infer<typeof announcementSchema>;
export type CreateAnnouncementDTO = z.infer<typeof createAnnouncementSchema>;
export type ClientPlatform = z.infer<typeof clientPlatformSchema>;
export type QuoteLanguage = z.infer<typeof quoteLanguageSchema>;
export type VatRate = z.infer<typeof vatRateSchema>;
export type ClientStage = z.infer<typeof clientStageSchema>;
export type OnboardingTaskStatus = z.infer<typeof onboardingTaskStatusSchema>;
export type OnboardingTaskCategory = z.infer<
  typeof onboardingTaskCategorySchema
>;
export type OnboardingTask = z.infer<typeof onboardingTaskSchema>;
export type ClientDocument = z.infer<typeof clientDocumentSchema>;
export type ClientProject = z.infer<typeof clientProjectSchema>;
export type Client = z.infer<typeof clientSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type QuoteBlockKind = z.infer<typeof quoteBlockKindSchema>;
export type QuoteTableRow = z.infer<typeof quoteTableRowSchema>;
export type QuoteTable = z.infer<typeof quoteTableSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type QuoteSection = z.infer<typeof quoteSectionSchema>;
export type QuotePaymentScheduleStep = z.infer<typeof quotePaymentScheduleStepSchema>;
export type QuoteInvestmentLineMode = z.infer<typeof quoteInvestmentLineModeSchema>;
export type QuoteInvestmentLine = z.infer<typeof quoteInvestmentLineSchema>;
export type QuotePartDisplayStyle = z.infer<typeof quotePartDisplayStyleSchema>;
export type QuotePart = z.infer<typeof quotePartSchema>;
export type QuoteConditionSubItem = z.infer<typeof quoteConditionSubItemSchema>;
export type QuoteConditionItem = z.infer<typeof quoteConditionItemSchema>;
export type QuoteCondition = z.infer<typeof quoteConditionSchema>;
export type QuoteAddon = z.infer<typeof quoteAddonSchema>;
export type QuoteCustomSection = z.infer<typeof quoteCustomSectionSchema>;
export type QuoteTemplateLocalizedContent = z.infer<
  typeof quoteTemplateLocalizedContentSchema
>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteDiscountType = z.infer<typeof quoteDiscountTypeSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteTemplateKind = z.infer<typeof quoteTemplateKindSchema>;
export type QuoteTemplate = z.infer<typeof quoteTemplateSchema>;
export type QuoteTemplateInput = z.infer<typeof quoteTemplateInputSchema>;
export type TimesheetSourceType = z.infer<typeof timesheetSourceTypeSchema>;
export type TimesheetStatus = z.infer<typeof timesheetStatusSchema>;
export type TimesheetSession = z.infer<typeof timesheetSessionSchema>;
export type Timesheet = z.infer<typeof timesheetSchema>;
export type TimesheetInput = z.infer<typeof timesheetInputSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectHealth = z.infer<typeof projectHealthSchema>;
export type ProjectSourceType = z.infer<typeof projectSourceTypeSchema>;
export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
