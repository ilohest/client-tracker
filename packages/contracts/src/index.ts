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
  role: z.enum(['user', 'admin']).default('user'),
  displayName: z.string().optional().nullable(),
  photoURL: z.string().optional().nullable(),
  color: z.string().default(USER_COLORS[7]),
  address: z.string().optional().default(''),
  billingStreet: z.string().optional().default(''),
  billingStreetNumber: z.string().optional().default(''),
  billingPostalCode: z.string().optional().default(''),
  billingCity: z.string().optional().default(''),
  website: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
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
  'lead',
  'quote_sent',
  'quote_signed',
  'content_pending',
  'build_in_progress',
  'review',
  'launch',
  'done',
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
  stage: clientStageSchema.default('lead'),
  notes: z.string().optional().default(''),
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

export const quoteSubsectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const quoteSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  subSections: z.array(quoteSubsectionSchema).default([]),
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

export const quoteConditionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().default(''),
  items: z.array(quoteConditionItemSchema).default([]),
});

export const quoteAddonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(quoteConditionItemSchema).default([]),
  price: z.number(),
  enabled: z.boolean().default(true),
});

export const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'refused']);
export const quoteDiscountTypeSchema = z.enum(['percent', 'fixed']);

export const quoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clientId: z.string().optional().default(''),
  title: z.string().default(''),
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
  emailDraft: z.string().default(''),
  emailSubject: z.string().default(''),
  emailBody: z.string().default(''),
  basePrice: z.number().default(0),
  discountType: quoteDiscountTypeSchema.default('percent'),
  discountValue: z.number().default(0),
  sections: z.array(quoteSectionSchema).default([]),
  conditions: z.array(quoteConditionSchema).default([]),
  addons: z.array(quoteAddonSchema).default([]),
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
export type QuoteSection = z.infer<typeof quoteSectionSchema>;
export type QuoteConditionSubItem = z.infer<typeof quoteConditionSubItemSchema>;
export type QuoteConditionItem = z.infer<typeof quoteConditionItemSchema>;
export type QuoteCondition = z.infer<typeof quoteConditionSchema>;
export type QuoteAddon = z.infer<typeof quoteAddonSchema>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteDiscountType = z.infer<typeof quoteDiscountTypeSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
