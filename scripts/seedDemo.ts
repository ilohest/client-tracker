// seedDemo.ts
// Cree (ou reinitialise) le compte demo public de Devisio avec des donnees fictives,
// etalees depuis le debut de l'annee pour un rendu realiste.
// Usage: npx tsx --tsconfig frontend/tsconfig.app.json scripts/seedDemo.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateAuthProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type {
  UserProfile,
  ClientInput,
  QuoteTemplateInput,
  QuoteInput,
  ProjectInput,
  TimesheetInput,
  QuotePart,
  ProjectMilestone,
} from '@client-tracker/contracts';
import {
  createDefaultQuoteTemplate,
  createDefaultQuoteAcceptance,
  createDefaultQuotePrinciples,
  createDefaultPaymentSchedule,
  createOnboardingTasks,
} from '@/lib/clientPresets';
import { createEntityId, generateQuoteReference, calculateQuotePartsTotals } from '@/utils/quote';

const firebaseConfig = {
  apiKey: 'AIzaSyC_po_4c3WnQtKYhH49QWPV2oJjcfgLTUU',
  authDomain: 'client-tracker-ce99d.firebaseapp.com',
  projectId: 'client-tracker-ce99d',
  storageBucket: 'client-tracker-ce99d.firebasestorage.app',
  messagingSenderId: '1075751922196',
  appId: '1:1075751922196:web:8adfcfd3de0c9f822d5501',
};

const DEMO_EMAIL = 'demo@isaure-lohest.com';
const DEMO_PASSWORD = 'DevisioDemo2026!';
const DEMO_DISPLAY_NAME = 'Camille Dubuisson';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helpers de dates (annee de reference : 2026, "aujourd'hui" = 6 juillet) ---
const dateOnly = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const iso = (y: number, m: number, d: number, h = 9, mi = 0): string =>
  new Date(Date.UTC(y, m - 1, d, h, mi)).toISOString();
const asDate = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

const wipeCollection = async (name: string, userId: string) => {
  const snapshot = await getDocs(query(collection(db, name), where('userId', '==', userId)));
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  console.log(`  - ${name}: ${snapshot.size} document(s) supprime(s)`);
};

const part = (
  title: string,
  price: number,
  sectionTitle: string,
  items: string[],
): QuotePart => ({
  id: createEntityId(),
  title,
  displayStyle: 'text',
  price,
  optional: false,
  includeInInvestment: true,
  priceNote: '',
  sections: [
    {
      id: createEntityId(),
      title: sectionTitle,
      description: '',
      displayMode: 'bullets',
      price: 0,
      items: items.map((text) => ({ id: createEntityId(), text, subItems: [] })),
      subSections: [],
    },
  ],
});

const shopifyParts = (): QuotePart[] => [
  part('Design & UX', 1400, 'Direction artistique', [
    'Moodboard et exploration visuelle',
    'Maquettes desktop et mobile (Figma)',
    '2 allers-retours de retouches inclus',
  ]),
  part('Développement Shopify', 2600, 'Intégration boutique', [
    'Habillage du thème sur base des maquettes validées',
    'Configuration des collections, fiches produits et navigation',
    'Intégration des moyens de paiement et de livraison',
  ]),
  part('Mise en ligne & formation', 500, 'Livraison', [
    'Tests finaux et mise en ligne',
    'Session de formation à la gestion de la boutique (1h)',
  ]),
];

const squarespaceParts = (): QuotePart[] => [
  part('Conception du site', 900, 'Arborescence & maquettage', [
    'Arborescence du site et parcours utilisateur',
    'Maquette de la page d’accueil',
  ]),
  part('Intégration Squarespace', 1600, 'Pages & contenus', [
    'Intégration des 5 pages principales (accueil, services, à propos, contact, blog)',
    'Réglages SEO de base et responsive',
  ]),
];

const saasParts = (): QuotePart[] => [
  part('Architecture & mise en place technique', 3000, 'Fondations', [
    'Choix et mise en place de la stack (frontend, backend, base de données)',
    'Environnements de dev, staging et production',
    'CI/CD de base',
  ]),
  part('Authentification & gestion des utilisateurs', 4000, 'Comptes & accès', [
    'Inscription, connexion, réinitialisation de mot de passe',
    'Gestion des rôles (admin / membre) et des équipes',
  ]),
  part('Dashboard & fonctionnalités coeur', 8000, 'Produit', [
    'Tableau de bord principal',
    'Fonctionnalités coeur définies au cadrage',
    'Gestion des données et exports',
  ]),
  part('Facturation & abonnements', 5000, 'Monétisation', [
    'Intégration Stripe (abonnements, essais gratuits)',
    'Page de facturation et gestion des plans',
  ]),
  part('Tests, déploiement & mise en production', 4000, 'Livraison', [
    'Tests de bout en bout sur les parcours critiques',
    'Mise en production et supervision de base',
  ]),
];

const customSiteParts = (): QuotePart[] => [
  part('Direction artistique sur mesure', 900, 'Design', [
    'Recherche visuelle et identité sur mesure (hors template)',
    'Maquettes desktop et mobile',
  ]),
  part('Développement front-end sur mesure', 1900, 'Développement', [
    'Intégration codée à la main (sans CMS ni page builder)',
    'Animations et interactions sur mesure',
    'Formulaire de contact et pages statiques',
  ]),
  part('Mise en ligne & hébergement', 400, 'Livraison', [
    'Configuration du nom de domaine et de l’hébergement',
    'Tests finaux multi-navigateurs',
  ]),
];

const erpIntegrationParts = (): QuotePart[] => [
  part('Analyse des flux ERP existants', 600, 'Cadrage', [
    'Audit des flux de données ERP actuels (commandes, stocks, clients)',
    'Spécification du mapping de données vers la plateforme B2B',
  ]),
  part('Développement du connecteur API', 1500, 'Intégration', [
    'Développement du connecteur ERP ↔ plateforme B2B',
    'Synchronisation des commandes et des niveaux de stock',
    'Gestion des erreurs et des relances automatiques',
  ]),
  part('Tests & mise en production', 300, 'Livraison', [
    'Tests avec des données réelles en environnement sandbox',
    'Mise en production et supervision des premières synchronisations',
  ]),
];

async function ensureDemoUser(): Promise<string> {
  try {
    const credentials = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    console.log(`Compte demo existant: ${credentials.user.uid}`);
    return credentials.user.uid;
  } catch (error: any) {
    if (error.code !== 'auth/invalid-credential' && error.code !== 'auth/user-not-found') {
      throw error;
    }
    const credentials = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    await updateAuthProfile(credentials.user, { displayName: DEMO_DISPLAY_NAME });
    console.log(`Compte demo cree: ${credentials.user.uid}`);
    return credentials.user.uid;
  }
}

async function main() {
  const uid = await ensureDemoUser();

  console.log('Nettoyage des donnees existantes...');
  await wipeCollection('clients', uid);
  await wipeCollection('quotes', uid);
  await wipeCollection('quoteTemplates', uid);
  await wipeCollection('projects', uid);
  await wipeCollection('timesheets', uid);

  console.log('Ecriture du profil...');
  const profile: UserProfile = {
    uid,
    email: DEMO_EMAIL,
    contactEmail: 'camille@devisio-demo.com',
    role: 'user',
    displayName: DEMO_DISPLAY_NAME,
    jobTitle: 'Développeuse web freelance',
    hourlyRate: 55,
    photoURL: null,
    color: '#e96a5f',
    address: '',
    billingStreet: 'Rue des Palais',
    billingStreetNumber: '44',
    billingPostalCode: '1030',
    billingCity: 'Bruxelles',
    website: 'https://devisio.isaure-lohest.com',
    logoUrl: '',
    logoPath: '',
    quotePdfTextColor: '#23262f',
    quotePdfTitleColor: '#23262f',
    quotePdfAccentColor: '#14161f',
    quotePdfHeadingFont: 'Fraunces',
    quotePdfHeadingFontVariant: '600',
    quotePdfHeadingFontGoogleFamily: 'Fraunces:opsz,wght@9..144,600',
    quotePdfBodyFont: 'Inter',
    quotePdfBodyFontVariant: 'regular',
    quotePdfBodyFontGoogleFamily: 'Inter:wght@400',
    billingCountry: 'BE',
    vatNumber: 'BE0987654321',
    createdAt: iso(2026, 1, 5),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), profile);

  console.log('Creation des clients...');
  const clientDefs: Array<ClientInput & { key: string; createdAt: string; updatedAt: string }> = [
    {
      key: 'kalimo',
      name: 'Thomas Reyners',
      firstName: 'Thomas',
      lastName: 'Reyners',
      companyName: 'Kalimo',
      contactEmail: 'thomas@kalimo.io',
      phone: '+32 475 88 12 40',
      address: '',
      street: 'Rue du Progrès',
      streetNumber: '55',
      postalCode: '1210',
      city: 'Bruxelles',
      website: 'https://kalimo.io',
      country: 'BE',
      isVatRegistered: true,
      vatNumber: 'BE0741852963',
      platform: 'custom',
      language: 'fr',
      stage: 'build_in_progress',
      notes: 'Startup SaaS RH, plateforme développée depuis janvier, beta privée en cours.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: createOnboardingTasks(),
      createdAt: iso(2026, 1, 6),
      updatedAt: iso(2026, 6, 20),
    },
    {
      key: 'studio',
      name: 'Elena Torres',
      firstName: 'Elena',
      lastName: 'Torres',
      companyName: 'Studio Torres Yoga',
      contactEmail: 'elena@studiotorres.es',
      phone: '+34 611 22 33 44',
      address: '',
      street: 'Calle Mayor',
      streetNumber: '21',
      postalCode: '28013',
      city: 'Madrid',
      website: 'https://studiotorres.es',
      country: 'ES',
      isVatRegistered: false,
      vatNumber: '',
      platform: 'squarespace',
      language: 'es',
      stage: 'done',
      notes: 'Site livré et en ligne depuis mars.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: [],
      createdAt: iso(2026, 1, 15),
      updatedAt: iso(2026, 3, 10),
    },
    {
      key: 'willems',
      name: 'Sophie Willems',
      firstName: 'Sophie',
      lastName: 'Willems',
      companyName: 'Cabinet Willems & Associés',
      contactEmail: 'sophie@willems-avocats.be',
      phone: '+32 2 345 67 89',
      address: '',
      street: 'Rue de la Loi',
      streetNumber: '78',
      postalCode: '1040',
      city: 'Bruxelles',
      website: 'https://willems-avocats.be',
      country: 'BE',
      isVatRegistered: true,
      vatNumber: 'BE0812345678',
      platform: 'custom',
      language: 'fr',
      stage: 'done',
      notes: 'Site vitrine sur mesure (hors CMS), livré début avril.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: [],
      createdAt: iso(2026, 1, 28),
      updatedAt: iso(2026, 4, 5),
    },
    {
      key: 'boulangerie',
      name: 'Nora Vandenberghe',
      firstName: 'Nora',
      lastName: 'Vandenberghe',
      companyName: 'Boulangerie du Parc',
      contactEmail: 'nora@boulangerieduparc.be',
      phone: '+32 470 12 34 56',
      address: '',
      street: 'Avenue du Parc',
      streetNumber: '12',
      postalCode: '1050',
      city: 'Bruxelles',
      website: 'https://boulangerieduparc.be',
      country: 'BE',
      isVatRegistered: true,
      vatNumber: 'BE0456789123',
      platform: 'shopify',
      language: 'fr',
      stage: 'build_in_progress',
      notes: 'Ouverture prévue pour la rentrée, souhaite un système de précommande.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: createOnboardingTasks(),
      createdAt: iso(2026, 5, 12),
      updatedAt: iso(2026, 6, 25),
    },
    {
      key: 'nordplast',
      name: 'Grégoire Dupont',
      firstName: 'Grégoire',
      lastName: 'Dupont',
      companyName: 'NordPlast Industries',
      contactEmail: 'g.dupont@nordplast-industries.com',
      phone: '+33 3 20 45 67 89',
      address: '',
      street: 'Zone Industrielle du Nord',
      streetNumber: '3',
      postalCode: '59000',
      city: 'Lille',
      website: 'https://nordplast-industries.com',
      country: 'FR',
      isVatRegistered: true,
      vatNumber: 'FR12345678901',
      platform: '',
      language: 'fr',
      stage: 'build_in_progress',
      notes: 'Intégration technique : connexion de leur ERP interne à la plateforme B2B de leurs distributeurs.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: [],
      createdAt: iso(2026, 6, 5),
      updatedAt: iso(2026, 6, 20),
    },
    {
      key: 'atelier',
      name: 'Marc Delvaux',
      firstName: 'Marc',
      lastName: 'Delvaux',
      companyName: 'Atelier Delvaux Céramique',
      contactEmail: 'marc@atelierdelvaux.com',
      phone: '+32 486 22 11 09',
      address: '',
      street: 'Rue de la Poterie',
      streetNumber: '8',
      postalCode: '4000',
      city: 'Liège',
      website: '',
      country: 'BE',
      isVatRegistered: true,
      vatNumber: 'BE0678912345',
      platform: 'squarespace',
      language: 'fr',
      stage: 'quote_sent',
      notes: 'Souhaite une vitrine simple avec galerie photo et page contact.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: [],
      createdAt: iso(2026, 6, 22),
      updatedAt: iso(2026, 6, 25),
    },
    {
      key: 'lead',
      name: 'Julien Petit',
      firstName: 'Julien',
      lastName: 'Petit',
      companyName: 'Petit Conseil',
      contactEmail: 'julien.petit@petitconseil.fr',
      phone: '+33 6 12 34 56 78',
      address: '',
      street: '',
      streetNumber: '',
      postalCode: '',
      city: 'Lyon',
      website: '',
      country: 'FR',
      isVatRegistered: false,
      vatNumber: '',
      platform: '',
      language: 'fr',
      stage: 'lead',
      notes: 'Premier contact, à relancer pour cadrer le besoin.',
      clientNotes: [],
      documents: [],
      projects: [],
      onboardingTasks: [],
      createdAt: iso(2026, 6, 29),
      updatedAt: iso(2026, 6, 29),
    },
  ];

  const clientIds: Record<string, string> = {};
  for (const { key, createdAt, updatedAt, ...clientInput } of clientDefs) {
    const docRef = await addDoc(collection(db, 'clients'), {
      ...clientInput,
      userId: uid,
      createdAt,
      updatedAt,
    });
    clientIds[key] = docRef.id;
  }
  const client = (key: string) => clientDefs.find((c) => c.key === key)!;

  console.log('Creation des templates de devis...');
  const baseTemplate: QuoteTemplateInput = {
    name: 'Base commune',
    kind: 'base',
    platform: 'other',
    customPlatformLabel: '',
    language: 'fr',
    vatRate: 21,
    projectSummary: '',
    emailSubject: '',
    emailBody: '',
    discountType: 'percent',
    discountValue: 0,
    parts: [],
    conditions: [],
    roadmap: [],
    acceptance: createDefaultQuoteAcceptance('fr'),
    principles: createDefaultQuotePrinciples('fr'),
    addons: [],
    paymentSchedule: createDefaultPaymentSchedule('fr'),
    localizedContent: {
      fr: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: createDefaultQuoteAcceptance('fr'), principles: createDefaultQuotePrinciples('fr'), addons: [], paymentSchedule: createDefaultPaymentSchedule('fr') },
      en: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: createDefaultQuoteAcceptance('en'), principles: createDefaultQuotePrinciples('en'), addons: [], paymentSchedule: createDefaultPaymentSchedule('en') },
      es: { projectSummary: '', emailSubject: '', emailBody: '', parts: [], conditions: [], roadmap: [], acceptance: createDefaultQuoteAcceptance('es'), principles: createDefaultQuotePrinciples('es'), addons: [], paymentSchedule: createDefaultPaymentSchedule('es') },
    },
  };
  await addDoc(collection(db, 'quoteTemplates'), {
    ...baseTemplate,
    userId: uid,
    createdAt: iso(2026, 1, 5),
    updatedAt: iso(2026, 1, 5),
  });

  const shopifyTemplate: QuoteTemplateInput = {
    ...createDefaultQuoteTemplate('Stack Shopify', 'shopify', 'fr', 'BE'),
    parts: shopifyParts(),
  };
  const shopifyTemplateRef = await addDoc(collection(db, 'quoteTemplates'), {
    ...shopifyTemplate,
    userId: uid,
    createdAt: iso(2026, 1, 5),
    updatedAt: iso(2026, 1, 5),
  });

  const squarespaceTemplate: QuoteTemplateInput = {
    ...createDefaultQuoteTemplate('Stack Squarespace', 'squarespace', 'fr', 'BE'),
    parts: squarespaceParts(),
  };
  const squarespaceTemplateRef = await addDoc(collection(db, 'quoteTemplates'), {
    ...squarespaceTemplate,
    userId: uid,
    createdAt: iso(2026, 1, 5),
    updatedAt: iso(2026, 1, 5),
  });

  const saasTemplate: QuoteTemplateInput = {
    ...createDefaultQuoteTemplate('Stack SaaS', 'custom', 'fr', 'BE'),
    parts: saasParts(),
  };
  const saasTemplateRef = await addDoc(collection(db, 'quoteTemplates'), {
    ...saasTemplate,
    userId: uid,
    createdAt: iso(2026, 1, 5),
    updatedAt: iso(2026, 1, 5),
  });

  const customSiteTemplate: QuoteTemplateInput = {
    ...createDefaultQuoteTemplate('Site sur mesure', 'custom', 'fr', 'BE'),
    parts: customSiteParts(),
  };
  const customSiteTemplateRef = await addDoc(collection(db, 'quoteTemplates'), {
    ...customSiteTemplate,
    userId: uid,
    createdAt: iso(2026, 1, 5),
    updatedAt: iso(2026, 1, 5),
  });

  console.log('Creation des devis...');
  const buildQuote = (
    c: (typeof clientDefs)[number],
    parts: QuotePart[],
    status: QuoteInput['status'],
    templateId: string,
    title: string,
    summary: string,
    quoteDate: string,
    refDate: Date,
  ): QuoteInput => {
    const totals = calculateQuotePartsTotals(parts, 21, 'percent', 0);
    return {
      clientId: clientIds[c.key],
      templateId,
      title,
      projectName: title,
      quoteDate,
      quoteRef: generateQuoteReference(c.name, refDate),
      platform: c.platform,
      customPlatformLabel: '',
      language: c.language,
      clientName: c.name,
      clientAddress: [c.street, c.streetNumber, c.postalCode, c.city].filter(Boolean).join(' '),
      clientWebsite: c.website,
      vatRate: 21,
      projectSummary: summary,
      investmentSummary: '',
      investmentAmount: 0,
      emailDraft: '',
      emailSubject: '',
      emailBody: '',
      discountType: 'percent',
      discountValue: 0,
      version: 1,
      versionGroupId: '',
      parts,
      conditions: [],
      roadmap: [],
      acceptance: createDefaultQuoteAcceptance(c.language),
      principles: createDefaultQuotePrinciples(c.language),
      addons: [],
      paymentSchedule: createDefaultPaymentSchedule(c.language),
      status,
      subtotal: totals.subtotal,
      totalWithVat: totals.totalWithVat,
    } as QuoteInput;
  };

  const kalimo = client('kalimo');
  const studio = client('studio');
  const willems = client('willems');
  const boulangerie = client('boulangerie');
  const nordplast = client('nordplast');
  const atelier = client('atelier');

  // --- Kalimo : plateforme SaaS, en cours depuis janvier ---
  const kalimoQuote = buildQuote(
    kalimo,
    saasParts(),
    'accepted',
    saasTemplateRef.id,
    'Développement plateforme SaaS Kalimo',
    'Développement de la plateforme SaaS Kalimo (gestion RH pour PME) : authentification, dashboard, facturation par abonnement.',
    dateOnly(2026, 1, 8),
    asDate(2026, 1, 8),
  );
  const kalimoQuoteRef = await addDoc(collection(db, 'quotes'), {
    ...kalimoQuote,
    userId: uid,
    createdAt: iso(2026, 1, 8),
    updatedAt: iso(2026, 1, 10),
  });

  // --- Studio Torres : site Squarespace, livré en mars ---
  const studioQuote = buildQuote(
    studio,
    squarespaceParts(),
    'accepted',
    squarespaceTemplateRef.id,
    'Refonte Studio Torres Yoga',
    'Refonte du site de Studio Torres Yoga sur Squarespace.',
    dateOnly(2026, 1, 20),
    asDate(2026, 1, 20),
  );
  const studioQuoteRef = await addDoc(collection(db, 'quotes'), {
    ...studioQuote,
    userId: uid,
    createdAt: iso(2026, 1, 20),
    updatedAt: iso(2026, 1, 22),
  });

  // --- Cabinet Willems : site custom, livré début avril ---
  const willemsQuote = buildQuote(
    willems,
    customSiteParts(),
    'accepted',
    customSiteTemplateRef.id,
    'Site vitrine sur mesure - Cabinet Willems & Associés',
    'Site vitrine sur mesure (hors CMS) pour le cabinet d’avocats Willems & Associés.',
    dateOnly(2026, 2, 5),
    asDate(2026, 2, 5),
  );
  const willemsQuoteRef = await addDoc(collection(db, 'quotes'), {
    ...willemsQuote,
    userId: uid,
    createdAt: iso(2026, 2, 5),
    updatedAt: iso(2026, 2, 7),
  });

  // --- Boulangerie du Parc : Shopify, en cours depuis fin mai ---
  const boulangerieQuote = buildQuote(
    boulangerie,
    shopifyParts(),
    'accepted',
    shopifyTemplateRef.id,
    'Refonte Boulangerie du Parc',
    'Refonte du site de Boulangerie du Parc sur Shopify, avec système de précommande.',
    dateOnly(2026, 5, 18),
    asDate(2026, 5, 18),
  );
  const boulangerieQuoteRef = await addDoc(collection(db, 'quotes'), {
    ...boulangerieQuote,
    userId: uid,
    createdAt: iso(2026, 5, 18),
    updatedAt: iso(2026, 5, 20),
  });

  // --- NordPlast : intervention API ERP <-> plateforme B2B, en cours depuis mi-juin ---
  const nordplastQuote = buildQuote(
    nordplast,
    erpIntegrationParts(),
    'accepted',
    customSiteTemplateRef.id,
    'Intégration API ERP ↔ plateforme B2B - NordPlast Industries',
    'Connexion de l’ERP interne de NordPlast Industries à la plateforme B2B de leurs distributeurs (synchronisation commandes & stocks).',
    dateOnly(2026, 6, 10),
    asDate(2026, 6, 10),
  );
  const nordplastQuoteRef = await addDoc(collection(db, 'quotes'), {
    ...nordplastQuote,
    userId: uid,
    createdAt: iso(2026, 6, 10),
    updatedAt: iso(2026, 6, 12),
  });

  // --- Atelier Delvaux : devis envoyé, pas encore accepté ---
  const atelierQuote = buildQuote(
    atelier,
    squarespaceParts(),
    'sent',
    squarespaceTemplateRef.id,
    'Refonte Atelier Delvaux Céramique',
    'Refonte du site de Atelier Delvaux Céramique sur Squarespace.',
    dateOnly(2026, 6, 25),
    asDate(2026, 6, 25),
  );
  await addDoc(collection(db, 'quotes'), {
    ...atelierQuote,
    userId: uid,
    createdAt: iso(2026, 6, 25),
    updatedAt: iso(2026, 6, 25),
  });

  console.log('Creation des projets...');
  const milestone = (
    label: string,
    status: ProjectMilestone['status'],
    kind: ProjectMilestone['kind'],
    date?: string,
  ): ProjectMilestone => ({ id: createEntityId(), label, status, kind, ...(date ? { date } : {}) });

  const projectDefs: Array<{
    key: string;
    quoteId: string;
    input: ProjectInput;
    createdAt: string;
    updatedAt: string;
  }> = [
    {
      key: 'kalimo',
      quoteId: kalimoQuoteRef.id,
      createdAt: iso(2026, 1, 15),
      updatedAt: iso(2026, 6, 20),
      input: {
        title: 'Plateforme SaaS Kalimo',
        description: 'Développement complet d’une plateforme SaaS de gestion RH pour PME : auth, dashboard, facturation par abonnement.',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: clientIds.kalimo,
        clientName: kalimo.name,
        color: '#6366f1',
        status: 'in_progress',
        health: 'ok',
        budgetExVat: kalimoQuote.subtotal,
        invoicedExVat: 16000,
        paidExVat: 14000,
        hourlyRate: 55,
        startedAt: dateOnly(2026, 1, 15),
        dueDate: dateOnly(2026, 7, 31),
        closedAt: '',
        blockedReason: '',
        nextAction: 'Finaliser les retours de la beta privée avant le lancement public.',
        milestones: [
          milestone('Cadrage & architecture', 'done', 'work', dateOnly(2026, 1, 30)),
          milestone('MVP authentification & dashboard', 'done', 'work', dateOnly(2026, 3, 15)),
          milestone('Fonctionnalités coeur produit', 'done', 'work', dateOnly(2026, 5, 10)),
          milestone('Beta privée avec premiers utilisateurs', 'done', 'work', dateOnly(2026, 6, 20)),
          milestone('Lancement public', 'todo', 'work'),
        ],
      },
    },
    {
      key: 'studio',
      quoteId: studioQuoteRef.id,
      createdAt: iso(2026, 1, 25),
      updatedAt: iso(2026, 3, 10),
      input: {
        title: 'Refonte Studio Torres Yoga',
        description: 'Site Squarespace pour un studio de yoga à Madrid.',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: clientIds.studio,
        clientName: studio.name,
        color: '#0ea5e9',
        status: 'closed',
        health: 'ok',
        budgetExVat: studioQuote.subtotal,
        invoicedExVat: studioQuote.subtotal,
        paidExVat: studioQuote.subtotal,
        hourlyRate: 55,
        startedAt: dateOnly(2026, 1, 25),
        dueDate: '',
        closedAt: dateOnly(2026, 3, 10),
        blockedReason: '',
        nextAction: '',
        milestones: [
          milestone('Devis accepté', 'done', 'quote_accepted', dateOnly(2026, 1, 20)),
          milestone('Maquettes validées', 'done', 'work', dateOnly(2026, 2, 5)),
          milestone('Intégration Squarespace', 'done', 'work', dateOnly(2026, 2, 25)),
          milestone('Mise en ligne', 'done', 'work', dateOnly(2026, 3, 10)),
        ],
      },
    },
    {
      key: 'willems',
      quoteId: willemsQuoteRef.id,
      createdAt: iso(2026, 2, 10),
      updatedAt: iso(2026, 4, 5),
      input: {
        title: 'Site vitrine sur mesure - Cabinet Willems & Associés',
        description: 'Site vitrine développé sur mesure (hors CMS) pour un cabinet d’avocats.',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: clientIds.willems,
        clientName: willems.name,
        color: '#14b8a6',
        status: 'closed',
        health: 'ok',
        budgetExVat: willemsQuote.subtotal,
        invoicedExVat: willemsQuote.subtotal,
        paidExVat: willemsQuote.subtotal,
        hourlyRate: 55,
        startedAt: dateOnly(2026, 2, 10),
        dueDate: '',
        closedAt: dateOnly(2026, 4, 5),
        blockedReason: '',
        nextAction: '',
        milestones: [
          milestone('Devis accepté', 'done', 'quote_accepted', dateOnly(2026, 2, 5)),
          milestone('Direction artistique validée', 'done', 'work', dateOnly(2026, 2, 24)),
          milestone('Développement front-end', 'done', 'work', dateOnly(2026, 3, 20)),
          milestone('Mise en ligne', 'done', 'work', dateOnly(2026, 4, 5)),
        ],
      },
    },
    {
      key: 'boulangerie',
      quoteId: boulangerieQuoteRef.id,
      createdAt: iso(2026, 5, 25),
      updatedAt: iso(2026, 6, 25),
      input: {
        title: 'Refonte Boulangerie du Parc',
        description: 'Boutique en ligne Shopify avec système de précommande.',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: clientIds.boulangerie,
        clientName: boulangerie.name,
        color: '#e96a5f',
        status: 'in_progress',
        health: 'ok',
        budgetExVat: boulangerieQuote.subtotal,
        invoicedExVat: boulangerieQuote.subtotal * 0.5,
        paidExVat: boulangerieQuote.subtotal * 0.5,
        hourlyRate: 55,
        startedAt: dateOnly(2026, 5, 25),
        dueDate: dateOnly(2026, 8, 15),
        closedAt: '',
        blockedReason: '',
        nextAction: 'Recevoir les photos des produits pour intégration.',
        milestones: [
          milestone('Devis accepté', 'done', 'quote_accepted', dateOnly(2026, 5, 18)),
          milestone('Acompte reçu', 'done', 'payment_received', dateOnly(2026, 5, 20)),
          milestone('Intégration boutique', 'todo', 'work'),
          milestone('Mise en ligne', 'todo', 'work'),
        ],
      },
    },
    {
      key: 'nordplast',
      quoteId: nordplastQuoteRef.id,
      createdAt: iso(2026, 6, 15),
      updatedAt: iso(2026, 6, 20),
      input: {
        title: 'Intégration API ERP ↔ plateforme B2B - NordPlast Industries',
        description: 'Connexion de l’ERP interne de NordPlast Industries à la plateforme B2B de leurs distributeurs : synchronisation des commandes et des stocks.',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: clientIds.nordplast,
        clientName: nordplast.name,
        color: '#f59e0b',
        status: 'in_progress',
        health: 'watch',
        budgetExVat: nordplastQuote.subtotal,
        invoicedExVat: nordplastQuote.subtotal * 0.4,
        paidExVat: nordplastQuote.subtotal * 0.4,
        hourlyRate: 55,
        startedAt: dateOnly(2026, 6, 15),
        dueDate: dateOnly(2026, 7, 20),
        closedAt: '',
        blockedReason: 'En attente des accès API sandbox de l’ERP côté client.',
        nextAction: 'Relancer NordPlast pour obtenir les credentials API sandbox.',
        milestones: [
          milestone('Devis accepté', 'done', 'quote_accepted', dateOnly(2026, 6, 10)),
          milestone('Cadrage technique & analyse des flux', 'done', 'work', dateOnly(2026, 6, 20)),
          milestone('Développement du connecteur API', 'todo', 'work'),
          milestone('Tests avec l’ERP client', 'todo', 'work'),
          milestone('Mise en production', 'todo', 'work'),
        ],
      },
    },
  ];

  const projectRefs: Record<string, string> = {};
  for (const { key, quoteId, input, createdAt, updatedAt } of projectDefs) {
    const ref = await addDoc(collection(db, 'projects'), {
      ...input,
      userId: uid,
      createdAt,
      updatedAt,
    });
    projectRefs[key] = ref.id;
    await updateDoc(doc(db, 'quotes', quoteId), { projectId: ref.id });
  }

  console.log('Creation des suivis de temps...');
  const timesheetDefs: Array<{
    input: TimesheetInput;
    totalTrackedSeconds: number;
    sessions: Array<{ title: string; start: string; end: string; hours: number }>;
    createdAt: string;
    updatedAt: string;
  }> = [
    {
      createdAt: iso(2026, 1, 16),
      updatedAt: iso(2026, 6, 20),
      input: {
        title: 'Plateforme SaaS Kalimo',
        projectId: projectRefs.kalimo,
        sourceType: 'quote',
        quoteId: kalimoQuoteRef.id,
        quoteRef: kalimoQuote.quoteRef,
        clientId: clientIds.kalimo,
        clientName: kalimo.name,
        color: '#6366f1',
        hourlyRate: 55,
        fixedPriceExVat: kalimoQuote.subtotal,
        projectStartDate: dateOnly(2026, 1, 15),
        status: 'open',
      },
      sessions: [
        { title: 'Architecture technique & setup', start: iso(2026, 1, 20, 9), end: iso(2026, 1, 20, 17), hours: 8 },
        { title: 'Authentification & gestion des utilisateurs', start: iso(2026, 3, 5, 9), end: iso(2026, 3, 5, 18), hours: 9 },
        { title: 'Dashboard & fonctionnalités coeur', start: iso(2026, 5, 4, 9), end: iso(2026, 5, 4, 18), hours: 9 },
        { title: 'Intégration Stripe & abonnements', start: iso(2026, 6, 10, 9), end: iso(2026, 6, 10, 17), hours: 8 },
      ],
      totalTrackedSeconds: 3600 * (8 + 9 + 9 + 8),
    },
    {
      createdAt: iso(2026, 5, 26),
      updatedAt: iso(2026, 6, 24),
      input: {
        title: 'Refonte Boulangerie du Parc',
        projectId: projectRefs.boulangerie,
        sourceType: 'quote',
        quoteId: boulangerieQuoteRef.id,
        quoteRef: boulangerieQuote.quoteRef,
        clientId: clientIds.boulangerie,
        clientName: boulangerie.name,
        color: '#e96a5f',
        hourlyRate: 55,
        fixedPriceExVat: boulangerieQuote.subtotal,
        projectStartDate: dateOnly(2026, 5, 25),
        status: 'open',
      },
      sessions: [
        { title: 'Maquettes & direction artistique', start: iso(2026, 5, 26, 9), end: iso(2026, 5, 26, 15), hours: 6 },
        { title: 'Intégration thème Shopify', start: iso(2026, 6, 24, 9), end: iso(2026, 6, 24, 15), hours: 6 },
      ],
      totalTrackedSeconds: 3600 * 12,
    },
    {
      createdAt: iso(2026, 6, 16),
      updatedAt: iso(2026, 6, 20),
      input: {
        title: 'Intégration API ERP ↔ plateforme B2B - NordPlast',
        projectId: projectRefs.nordplast,
        sourceType: 'quote',
        quoteId: nordplastQuoteRef.id,
        quoteRef: nordplastQuote.quoteRef,
        clientId: clientIds.nordplast,
        clientName: nordplast.name,
        color: '#f59e0b',
        hourlyRate: 55,
        fixedPriceExVat: nordplastQuote.subtotal,
        projectStartDate: dateOnly(2026, 6, 15),
        status: 'open',
      },
      sessions: [
        { title: 'Analyse des flux ERP existants', start: iso(2026, 6, 16, 9), end: iso(2026, 6, 16, 13), hours: 4 },
        { title: 'Cadrage du connecteur API', start: iso(2026, 6, 20, 9), end: iso(2026, 6, 20, 13), hours: 4 },
      ],
      totalTrackedSeconds: 3600 * 8,
    },
  ];

  for (const { input, sessions, totalTrackedSeconds, createdAt, updatedAt } of timesheetDefs) {
    await addDoc(collection(db, 'timesheets'), {
      ...input,
      userId: uid,
      totalTrackedSeconds,
      sessions: sessions.map((s) => ({
        id: createEntityId(),
        title: s.title,
        startedAt: s.start,
        endedAt: s.end,
        durationSeconds: 3600 * s.hours,
      })),
      createdAt,
      updatedAt,
    });
  }

  console.log('\nTermine.');
  console.log(`Compte demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Erreur seed demo:', error);
  process.exit(1);
});
