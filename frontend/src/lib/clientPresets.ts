import type { ClientPlatform, ClientProject, ClientStage, OnboardingTask, QuoteAddon, QuoteCondition, QuoteConditionItem, QuoteDiscountType, QuoteLanguage, QuotePaymentScheduleStep, QuoteStatus, QuoteTemplateInput, QuoteTemplateLocalizedContent, VatRate } from '@client-tracker/contracts';
import { isEuroCountry } from '@/lib/countries';

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type LocalizedCopy = Record<QuoteLanguage, string>;

const pick = (copy: LocalizedCopy, language: QuoteLanguage): string => copy[language];

const emptyLocalizedCopy = (): LocalizedCopy => ({ fr: '', en: '', es: '' });

export const estimatedTimelineTitles: LocalizedCopy = {
  fr: 'Calendrier estimé',
  en: 'Estimated timeline',
  es: 'Calendario estimado',
};

export const getEstimatedTimelineTitle = (language: QuoteLanguage): string =>
  estimatedTimelineTitles[language] || estimatedTimelineTitles.fr;

const bulletItemsFromCopy = (value: string): QuoteConditionItem[] => {
  const lines = value
    .split('\n')
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => line.trim().length > 0);

  const items: QuoteConditionItem[] = [];
  let currentItem: QuoteConditionItem | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isSubItem = /^\s{2,}[•\-]/.test(line);
    const text = trimmed.replace(/^[•\-]\s*/, '');

    if (isSubItem && currentItem) {
      currentItem.subItems.push({ id: createId(), text });
      return;
    }

    currentItem = {
      id: createId(),
      text,
      subItems: [],
    };
    items.push(currentItem);
  });

  return items;
};

export const platformOptions: Array<{ label: string; value: ClientPlatform }> = [
  { label: 'Shopify', value: 'shopify' },
  { label: 'WordPress', value: 'wordpress' },
  { label: 'Webflow', value: 'webflow' },
  { label: 'Squarespace', value: 'squarespace' },
  { label: 'Custom', value: 'custom' },
  { label: 'Autre', value: 'other' },
];

export const languageOptions: Array<{ label: string; value: QuoteLanguage }> = [
  { label: 'Français', value: 'fr' },
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
];

export const vatOptions: Array<{ label: string; value: VatRate }> = [
  { label: 'TVA 21%', value: 21 },
  { label: 'TVA 0%', value: 0 },
];

/** Métadonnées d'un statut de devis : libellé, couleur de tag, ordre du cycle de vie. */
export interface QuoteStatusMeta {
  label: string;
  tagClass: string;
  /** true = le devis est considéré comme figé (ne devrait plus être édité). */
  locked: boolean;
}

export const quoteStatusMeta: Record<QuoteStatus, QuoteStatusMeta> = {
  draft: { label: 'Brouillon', tagClass: '!bg-surface-dark/8 !text-surface-dark', locked: false },
  finalized: { label: 'Finalisé', tagClass: '!bg-indigo-500/12 !text-indigo-700', locked: true },
  sent: { label: 'Envoyé', tagClass: '!bg-primary/12 !text-primary', locked: true },
  accepted: { label: 'Accepté', tagClass: '!bg-emerald-500/12 !text-emerald-700', locked: true },
  refused: { label: 'Refusé', tagClass: '!bg-rose-500/12 !text-rose-700', locked: true },
  revision_requested: { label: 'Révision demandée', tagClass: '!bg-amber-500/15 !text-amber-700', locked: false },
  superseded: { label: 'Remplacé', tagClass: '!bg-purple-500/12 !text-purple-700', locked: true },
};

export const quoteStatusOptions: Array<{ label: string; value: QuoteStatus }> = (
  Object.keys(quoteStatusMeta) as QuoteStatus[]
).map((value) => ({ label: quoteStatusMeta[value].label, value }));

export const discountTypeOptions: Array<{ label: string; value: QuoteDiscountType }> = [
  { label: 'Pourcentage', value: 'percent' },
  { label: 'Montant fixe', value: 'fixed' },
];

export const createDefaultPaymentSchedule = (language: QuoteLanguage = 'fr'): QuotePaymentScheduleStep[] => {
  const labels: Record<QuoteLanguage, string[]> = {
    fr: ['Acompte à la validation du devis', 'Paiement intermédiaire', 'Solde à la livraison'],
    en: ['Deposit on quote approval', 'Intermediate payment', 'Balance on delivery'],
    es: ['Anticipo al aprobar el presupuesto', 'Pago intermedio', 'Saldo a la entrega'],
  };

  return [
    { id: createId(), label: labels[language][0], mode: 'percent', value: 40 },
    { id: createId(), label: labels[language][1], mode: 'percent', value: 40 },
    { id: createId(), label: labels[language][2], mode: 'percent', value: 20 },
  ];
};

export const clientStageOptions: Array<{ label: string; value: ClientStage }> = [
  { label: 'Lead', value: 'lead' },
  { label: 'Devis envoyé', value: 'quote_sent' },
  { label: 'Devis signé', value: 'quote_signed' },
  { label: 'Contenus en attente', value: 'content_pending' },
  { label: 'Production', value: 'build_in_progress' },
  { label: 'Relecture', value: 'review' },
  { label: 'Mise en ligne', value: 'launch' },
  { label: 'Terminé', value: 'done' },
];

export const euCountryCodes = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK',
]);

const getPlatformSpecificCondition = (platform: ClientPlatform): LocalizedCopy => {
  switch (platform) {
    case 'shopify':
      return {
        fr: '• Le projet est conçu sur base des capacités natives de Shopify et du thème retenu\n  • Le périmètre couvre les réglages, gabarits, sections et personnalisations raisonnables prévus au devis\n  • Toute fonctionnalité nécessitant une app tierce, un développement spécifique ou une logique avancée sort du cadre standard sauf mention explicite\n• Frais et outils non inclus\n  • Abonnement Shopify, applications tierces, licences premium, passerelles de paiement et frais récurrents éventuels\n  • Ces coûts restent à charge du client sauf mention contraire dans le devis',
        en: '• The project is built around Shopify native capabilities and the selected theme\n  • The scope covers the settings, templates, sections, and reasonable customizations listed in the quote\n  • Any feature requiring a third-party app, custom development, or advanced logic falls outside the standard scope unless explicitly included\n• Fees and tools not included\n  • Shopify subscription, third-party apps, premium licenses, payment gateways, and any recurring costs\n  • These costs remain the client’s responsibility unless otherwise stated in the quote',
        es: '• El proyecto se desarrolla en base a las capacidades nativas de Shopify y al tema seleccionado\n  • El alcance cubre ajustes, plantillas, secciones y personalizaciones razonables previstas en el presupuesto\n  • Cualquier funcionalidad que requiera una app externa, desarrollo a medida o lógica avanzada queda fuera del alcance estándar salvo mención expresa\n• Gastos y herramientas no incluidos\n  • Suscripción de Shopify, apps de terceros, licencias premium, pasarelas de pago y posibles costes recurrentes\n  • Estos costes corren a cargo del cliente salvo indicación contraria en el presupuesto',
      };
    case 'wordpress':
      return {
        fr: '• Le projet repose sur WordPress, le thème validé et les extensions retenues au cadrage\n  • Le périmètre comprend l’intégration et les ajustements explicitement prévus au devis\n  • Toute extension complexe, fonctionnalité sur mesure ou intégration tierce avancée peut nécessiter un complément\n• Frais et outils non inclus\n  • Licences premium, renouvellements, hébergement, maintenance, services tiers et coûts récurrents\n  • Ces frais restent à charge du client sauf mention contraire',
        en: '• The project relies on WordPress, the approved theme, and the plugins selected during scoping\n  • The scope includes the integrations and adjustments explicitly listed in the quote\n  • Any complex plugin setup, custom feature, or advanced third-party integration may require an additional estimate\n• Fees and tools not included\n  • Premium licenses, renewals, hosting, maintenance, third-party services, and recurring costs\n  • These costs remain the client’s responsibility unless otherwise stated',
        es: '• El proyecto se basa en WordPress, el tema validado y los plugins definidos durante el alcance\n  • El alcance incluye las integraciones y ajustes previstos expresamente en el presupuesto\n  • Cualquier plugin complejo, funcionalidad a medida o integración avanzada con terceros puede requerir un complemento\n• Gastos y herramientas no incluidos\n  • Licencias premium, renovaciones, hosting, mantenimiento, servicios de terceros y costes recurrentes\n  • Estos gastos corren a cargo del cliente salvo indicación contraria',
      };
    case 'webflow':
      return {
        fr: '• Le projet s’appuie sur les capacités natives de Webflow, son CMS et des interactions raisonnables\n  • Le périmètre couvre la structure, les collections CMS, les animations et l’intégration prévues au devis\n  • Toute logique métier spécifique, localisation avancée ou besoin dépassant les limites natives de Webflow peut nécessiter un chiffrage complémentaire\n• Frais et outils non inclus\n  • Plan Webflow, hébergement, localisation payante, apps ou services tiers éventuels\n  • Ces coûts restent à charge du client sauf mention contraire',
        en: '• The project relies on Webflow native capabilities, its CMS, and reasonable interactions\n  • The scope covers the structure, CMS collections, animations, and integrations listed in the quote\n  • Any custom business logic, advanced localisation, or need beyond Webflow native limits may require an additional estimate\n• Fees and tools not included\n  • Webflow plan, hosting, paid localisation, apps, or any third-party services\n  • These costs remain the client’s responsibility unless otherwise stated',
        es: '• El proyecto se apoya en las capacidades nativas de Webflow, su CMS y unas interacciones razonables\n  • El alcance cubre la estructura, las colecciones CMS, animaciones e integraciones previstas en el presupuesto\n  • Cualquier lógica de negocio específica, localización avanzada o necesidad que supere los límites nativos de Webflow puede requerir presupuesto adicional\n• Gastos y herramientas no incluidos\n  • Plan de Webflow, hosting, localización de pago, apps o servicios de terceros\n  • Estos costes corren a cargo del cliente salvo indicación contraria',
      };
    case 'squarespace':
      return {
        fr: '• Le projet s’appuie sur les capacités natives de Squarespace, son éditeur visuel et des ajustements front-end raisonnables\n  • Le périmètre couvre la construction des pages, l’intégration des contenus et les réglages explicitement listés au devis\n  • Toute personnalisation avancée, intégration tierce, injection de code complexe ou besoin dépassant les possibilités natives de Squarespace peut faire l’objet d’un complément\n• Frais et services non inclus\n  • Abonnement Squarespace, nom de domaine, email professionnel, extensions tierces et coûts récurrents éventuels\n  • Si la prise de rendez-vous en ligne repose sur Acuity Scheduling, l’abonnement Acuity ainsi que toute option payante associée restent à charge du client\n  • Ces coûts restent à charge du client sauf mention contraire dans le devis',
        en: '• The project relies on native Squarespace capabilities, its visual editor, and reasonable front-end adjustments\n  • The scope covers page building, content integration, and the settings explicitly listed in the quote\n  • Any advanced customization, third-party integration, complex code injection, or need beyond Squarespace native capabilities may require an additional estimate\n• Fees and services not included\n  • Squarespace subscription, domain name, professional email, third-party extensions, and any recurring costs\n  • If online booking relies on Acuity Scheduling, the Acuity subscription and any related paid options remain the client’s responsibility\n  • These costs remain the client’s responsibility unless otherwise stated in the quote',
        es: '• El proyecto se basa en las capacidades nativas de Squarespace, su editor visual y ajustes front-end razonables\n  • El alcance cubre la construcción de páginas, la integración de contenidos y los ajustes indicados expresamente en el presupuesto\n  • Cualquier personalización avanzada, integración de terceros, inyección de código compleja o necesidad fuera de las capacidades nativas de Squarespace puede requerir un presupuesto adicional\n• Gastos y servicios no incluidos\n  • Suscripción de Squarespace, dominio, email profesional, extensiones de terceros y posibles costes recurrentes\n  • Si la reserva online se apoya en Acuity Scheduling, la suscripción de Acuity y cualquier opción de pago asociada corren a cargo del cliente\n  • Estos costes corren a cargo del cliente salvo indicación contraria en el presupuesto',
      };
    case 'custom':
      return {
        fr: '• Pour un projet sur mesure, seules les fonctionnalités, intégrations et livrables explicitement décrits dans le devis sont inclus\n  • Les développements spécifiques, logiques métier, automatisations ou connexions externes sont limités à ce qui est détaillé au devis\n  • Toute demande complémentaire ou extension de périmètre fera l’objet d’un accord et d’un chiffrage additionnels\n• Frais et outils non inclus\n  • Hébergement, infrastructure, services tiers, licences, APIs payantes, maintenance ou coûts récurrents éventuels\n  • Ces coûts restent à charge du client sauf mention contraire',
        en: '• For a custom project, only the features, integrations, and deliverables explicitly described in the quote are included\n  • Custom development, business logic, automations, or external connections are limited to what is detailed in the quote\n  • Any additional request or scope extension will require approval and an extra estimate\n• Fees and tools not included\n  • Hosting, infrastructure, third-party services, licenses, paid APIs, maintenance, or recurring costs\n  • These costs remain the client’s responsibility unless otherwise stated',
        es: '• Para un proyecto a medida, solo se incluyen las funcionalidades, integraciones y entregables descritos explícitamente en el presupuesto\n  • El desarrollo específico, la lógica de negocio, automatizaciones o conexiones externas se limitan a lo detallado en el presupuesto\n  • Cualquier solicitud adicional o ampliación de alcance requerirá validación y presupuesto extra\n• Gastos y herramientas no incluidos\n  • Hosting, infraestructura, servicios de terceros, licencias, APIs de pago, mantenimiento o costes recurrentes\n  • Estos costes corren a cargo del cliente salvo indicación contraria',
      };
    default:
      return {
        fr: '• La prestation couvre exclusivement le périmètre décrit dans le devis\n  • Les outils, intégrations et livrables sont limités à ce qui est explicitement validé\n  • Toute demande technique, fonctionnelle ou créative non incluse pourra nécessiter validation et complément budgétaire\n• Frais et outils non inclus\n  • Tout service tiers, licence, abonnement, hébergement ou coût récurrent non mentionné au devis\n  • Ces coûts restent à charge du client sauf mention contraire',
        en: '• The delivery only covers the scope described in the quote\n  • Tools, integrations, and deliverables are limited to what has been explicitly approved\n  • Any technical, functional, or creative request not included may require approval and an additional budget\n• Fees and tools not included\n  • Any third-party service, license, subscription, hosting, or recurring cost not listed in the quote\n  • These costs remain the client’s responsibility unless otherwise stated',
        es: '• La prestación cubre únicamente el alcance descrito en el presupuesto\n  • Las herramientas, integraciones y entregables se limitan a lo expresamente validado\n  • Cualquier solicitud técnica, funcional o creativa no incluida puede requerir validación y presupuesto adicional\n• Gastos y herramientas no incluidos\n  • Cualquier servicio externo, licencia, suscripción, hosting o coste recurrente no indicado en el presupuesto\n  • Estos costes corren a cargo del cliente salvo indicación contraria',
      };
  }
};

const getPaymentCondition = (countryCode: string): LocalizedCopy => {
  const euro = isEuroCountry(countryCode);

  if (!euro) {
    return {
      fr: 'Le paiement s’effectue selon l’échéancier précisé dans le devis. Tout retard de paiement peut suspendre la prestation ou la livraison finale.\n\nLe devis et la facturation sont établis en EUR.\nLes conversions de devise, frais bancaires internationaux et écarts de change éventuels restent à charge du client.\nLe montant reçu doit correspondre au montant facturé en euros, net de frais.',
      en: 'Payment follows the schedule stated in the quote. Any late payment may suspend the project or final delivery.\n\nThe quote and invoicing are issued in EUR.\nAny currency conversion, international bank fees, or exchange-rate differences remain the client’s responsibility.\nThe amount received must match the invoiced EUR amount, net of fees.',
      es: 'El pago se realiza según el calendario indicado en el presupuesto. Cualquier retraso de pago puede suspender la prestación o la entrega final.\n\nEl presupuesto y la facturación se emiten en EUR.\nCualquier conversión de divisa, comisión bancaria internacional o diferencia de cambio corre a cargo del cliente.\nEl importe recibido debe corresponder al importe facturado en euros, neto de comisiones.',
    };
  }

  return {
    fr: 'Le paiement s’effectue selon l’échéancier précisé dans le devis. Tout retard de paiement peut suspendre la prestation ou la livraison finale. Les éventuels frais bancaires restent à charge du client.',
    en: 'Payment follows the schedule stated in the quote. Any late payment may suspend the project or final delivery. Any bank fees remain the client’s responsibility.',
    es: 'El pago se realiza según el calendario indicado en el presupuesto. Cualquier retraso de pago puede suspender la prestación o la entrega final. Los posibles gastos bancarios corren a cargo del cliente.',
  };
};

const createQuoteConditionTemplates = (
  platform: ClientPlatform,
  clientCountry: string,
): Array<{ title: LocalizedCopy; body: LocalizedCopy }> => [
  {
    title: { fr: '1. Périmètre du projet', en: '1. Project scope', es: '1. Alcance del proyecto' },
    body: {
      fr: 'Le devis couvre uniquement les prestations, livrables et pages explicitement mentionnés. Toute demande complémentaire ou évolution hors périmètre pourra faire l’objet d’un devis additionnel.',
      en: 'The quote only covers the services, deliverables, and pages explicitly listed. Any additional request or scope extension may require a separate estimate.',
      es: 'El presupuesto cubre únicamente los servicios, entregables y páginas indicados expresamente. Cualquier petición adicional o ampliación de alcance podrá requerir un presupuesto aparte.',
    },
  },
  {
    title: { fr: '2. Révisions', en: '2. Revisions', es: '2. Revisiones' },
    body: {
      fr: 'Le projet inclut un nombre raisonnable d’ajustements consolidés conformément au périmètre convenu. Des demandes successives, contradictoires ou hors cadre peuvent entraîner un complément.',
      en: 'The project includes a reasonable number of consolidated revisions within the agreed scope. Successive, contradictory, or out-of-scope requests may generate an additional fee.',
      es: 'El proyecto incluye un número razonable de revisiones consolidadas dentro del alcance acordado. Solicitudes sucesivas, contradictorias o fuera de alcance pueden generar un coste adicional.',
    },
  },
  {
    title: { fr: '3. Validation des livrables', en: '3. Deliverable validation', es: '3. Validación de entregables' },
    body: {
      fr: 'Chaque phase soumise au client est considérée comme validée après retour explicite ou en l’absence de remarque structurée dans un délai raisonnable. Toute modification majeure après validation peut être replanifiée et refacturée.',
      en: 'Each project phase submitted to the client is considered approved after explicit validation or in the absence of structured feedback within a reasonable timeframe. Major changes after approval may be rescheduled and billed separately.',
      es: 'Cada fase enviada al cliente se considera validada tras una confirmación explícita o en ausencia de feedback estructurado en un plazo razonable. Los cambios importantes después de la validación pueden replanificarse y facturarse aparte.',
    },
  },
  {
    title: { fr: '4. Livraison finale', en: '4. Final delivery', es: '4. Entrega final' },
    body: {
      fr: 'La livraison finale intervient après validation des éléments prévus au devis et régularisation des paiements dus. Les transferts de propriété, exports, accès ou fichiers finaux sont remis à ce stade.',
      en: 'Final delivery takes place after approval of the quoted deliverables and settlement of the outstanding payments. Ownership transfer, exports, access, or final files are delivered at that stage.',
      es: 'La entrega final se realiza una vez validados los elementos previstos en el presupuesto y regularizados los pagos pendientes. La transferencia de propiedad, exports, accesos o archivos finales se entregan en ese momento.',
    },
  },
  {
    title: { fr: '5. Contenus & accès client', en: '5. Client content & access', es: '5. Contenidos y accesos del cliente' },
    body: {
      fr: 'Le client fournit dans les temps les contenus, visuels, références, validations et accès nécessaires au bon déroulement du projet. Tout retard sur ces éléments peut décaler le planning sans engager la responsabilité de la prestataire.',
      en: 'The client provides the content, visuals, references, approvals, and access required for the project on time. Any delay on these items may shift the schedule without engaging the provider’s liability.',
      es: 'El cliente facilita a tiempo los contenidos, visuales, referencias, validaciones y accesos necesarios para el proyecto. Cualquier retraso en estos elementos puede desplazar el calendario sin comprometer la responsabilidad de la prestadora.',
    },
  },
  {
    title: { fr: '6. Cadre technique de la plateforme', en: '6. Platform technical scope', es: '6. Marco técnico de la plataforma' },
    body: getPlatformSpecificCondition(platform),
  },
  {
    title: { fr: '7. Planning & délais', en: '7. Timeline & delays', es: '7. Planning y plazos' },
    body: {
      fr: 'Le planning communiqué est indicatif et dépend notamment de la réactivité du client, de la réception des contenus, des validations intermédiaires et des éventuels prestataires tiers. Une période d’inactivité prolongée peut nécessiter une replanification.',
      en: 'The proposed timeline is indicative and depends on the client’s responsiveness, content delivery, intermediate approvals, and any third-party providers involved. A prolonged inactive period may require rescheduling.',
      es: 'El calendario propuesto es orientativo y depende de la rapidez del cliente, de la entrega de contenidos, de las validaciones intermedias y de posibles proveedores externos. Un periodo prolongado de inactividad puede requerir replanificación.',
    },
  },
  {
    title: { fr: '8. Prix, paiement & devise', en: '8. Pricing, payment & currency', es: '8. Precio, pago y divisa' },
    body: getPaymentCondition(clientCountry),
  },
];

const getQuoteRoadmapTemplates = (
  platform: ClientPlatform,
): Array<{ title: LocalizedCopy; body: LocalizedCopy }> => {
  if (platform === 'squarespace') {
    return [
      {
        title: {
          fr: '1. Analyse & structure',
          en: '1. Analysis & structure',
          es: '1. Análisis y estructura',
        },
        body: {
          fr: '• Analyse de l’existant, des objectifs et des contenus à valoriser\n• Définition de la structure du site, des pages et des priorités de navigation\n• Choix de l’approche de mise en page Squarespace la plus adaptée\n• Préparation de la direction visuelle et des bases du projet',
          en: '• Analysis of the current situation, goals, and the content to highlight\n• Definition of the site structure, pages, and navigation priorities\n• Choice of the most suitable Squarespace page-building approach\n• Preparation of the visual direction and the project foundations',
          es: '• Análisis del contexto actual, los objetivos y los contenidos a destacar\n• Definición de la estructura del sitio, las páginas y las prioridades de navegación\n• Elección del enfoque de maquetación en Squarespace más adecuado\n• Preparación de la dirección visual y de las bases del proyecto',
        },
      },
      {
        title: {
          fr: '2. Design & construction',
          en: '2. Design & build',
          es: '2. Diseño y construcción',
        },
        body: {
          fr: '• Construction des pages dans Squarespace et mise en place d’une structure cohérente\n• Mise en place des styles, sections et layouts dans un cadre cohérent\n• Ajustements responsive et réglages principaux du site\n• Intégration des éléments clés pour une expérience claire et fluide',
          en: '• Page building in Squarespace and setup of a coherent page structure\n• Setup of styles, sections, and layouts within a cohesive framework\n• Responsive refinements and core site settings\n• Integration of the key elements for a clear and seamless experience',
          es: '• Construcción de páginas en Squarespace y definición de una estructura coherente\n• Configuración de estilos, secciones y layouts dentro de un marco coherente\n• Ajustes responsive y configuración principal del sitio\n• Integración de los elementos clave para una experiencia clara y fluida',
        },
      },
      {
        title: {
          fr: '3. Contenus, SEO & tests',
          en: '3. Content, SEO & testing',
          es: '3. Contenidos, SEO y testing',
        },
        body: {
          fr: '• Intégration des contenus dans les pages prévues\n• Paramétrage du SEO on-page, des métadonnées, des formulaires et des réglages essentiels\n• Vérifications desktop et mobile, puis ajustements finaux\n• Contrôle de cohérence globale avant mise en ligne',
          en: '• Integration of the content into the planned pages\n• Setup of on-page SEO, metadata, forms, and essential settings\n• Desktop and mobile checks, followed by final refinements\n• Global consistency review before launch',
          es: '• Integración de los contenidos en las páginas previstas\n• Configuración del SEO on-page, metadatos, formularios y ajustes esenciales\n• Verificaciones en desktop y móvil, seguidas de ajustes finales\n• Revisión de la coherencia global antes del lanzamiento',
        },
      },
      {
        title: {
          fr: '4. Mise en ligne, transmission & accompagnement',
          en: '4. Launch, handover & support',
          es: '4. Lanzamiento, handover y soporte',
        },
        body: {
          fr: '• Mise en ligne du site Squarespace et validation des points essentiels\n• Transmission des accès et accompagnement sur la gestion du site\n• Accompagnement post-livraison pour sécuriser les derniers ajustements',
          en: '• Squarespace website launch and validation of the key checkpoints\n• Access handover and guidance on how to manage the site\n• Post-delivery support to secure the final adjustments',
          es: '• Lanzamiento del sitio Squarespace y validación de los puntos clave\n• Entrega de accesos y handover sobre la gestión del sitio\n• Soporte post-entrega para asegurar los últimos ajustes',
        },
      },
      {
        title: estimatedTimelineTitles,
        body: {
          fr: '• Environ 4 à 5 semaines, selon la disponibilité des contenus et les délais de validation.',
          en: '• Approximately 4 to 5 weeks, depending on content readiness and validation timelines.',
          es: '• Aproximadamente 4 a 5 semanas, según la disponibilidad de los contenidos y los tiempos de validación.',
        },
      },
    ];
  }

  return [
    {
      title: {
        fr: '1. Analyse & préparation',
        en: '1. Analysis & preparation',
        es: '1. Análisis y preparación',
      },
      body: {
        fr: '',
        en: '',
        es: '',
      },
    },
    {
      title: {
        fr: '2. Développement & intégration',
        en: '2. Development & integration',
        es: '2. Desarrollo e integración',
      },
      body: {
        fr: '',
        en: '',
        es: '',
      },
    },
    {
      title: {
        fr: '3. Ajustements & tests',
        en: '3. Refinements & testing',
        es: '3. Ajustes y testing',
      },
      body: {
        fr: '',
        en: '',
        es: '',
      },
    },
    {
      title: {
        fr: '4. Livraison, transmission & accompagnement',
        en: '4. Delivery, handover & support',
        es: '4. Entrega, handover y soporte',
      },
      body: {
        fr: '',
        en: '',
        es: '',
      },
    },
    {
      title: estimatedTimelineTitles,
      body: {
        fr: '',
        en: '',
        es: '',
      },
    },
  ];
};

const addonTemplates: Array<{ title: LocalizedCopy; description: LocalizedCopy; price: number; unitLabel?: LocalizedCopy }> = [
  {
    title: { fr: 'Assistance horaire - pack 5 heures', en: 'Hourly support - 5-hour pack', es: 'Soporte por horas - pack 5 horas' },
    description: {
      fr: '• Valable 12 mois\n• Accompagnement ponctuel, ajustements, optimisations ou assistance client\n• Tarif horaire indicatif : 48,00 EUR / h',
      en: '• Valid for 12 months\n• Ongoing support, adjustments, optimisations or client assistance\n• Indicative hourly rate: EUR 48.00 / h',
      es: '• Válido durante 12 meses\n• Soporte puntual, ajustes, optimizaciones o asistencia al cliente\n• Tarifa horaria orientativa: 48,00 EUR / h',
    },
    price: 240,
  },
  {
    title: { fr: 'Assistance horaire - pack 10 heures', en: 'Hourly support - 10-hour pack', es: 'Soporte por horas - pack 10 horas' },
    description: {
      fr: '• Valable 12 mois\n• Accompagnement ponctuel, ajustements, optimisations ou assistance client\n• Tarif horaire indicatif : 45,00 EUR / h',
      en: '• Valid for 12 months\n• Ongoing support, adjustments, optimisations or client assistance\n• Indicative hourly rate: EUR 45.00 / h',
      es: '• Válido durante 12 meses\n• Soporte puntual, ajustes, optimizaciones o asistencia al cliente\n• Tarifa horaria orientativa: 45,00 EUR / h',
    },
    price: 450,
  },
  {
    title: { fr: 'Création de logo simple', en: 'Basic logo design', es: 'Diseño básico de logo' },
    description: {
      fr: '• Inclut 2 propositions de logo\n• Inclut 2 cycles de révision',
      en: '• Includes 2 logo proposals\n• Includes 2 revision rounds',
      es: '• Incluye 2 propuestas de logo\n• Incluye 2 rondas de revisión',
    },
    price: 240,
  },
  {
    title: { fr: 'Mise en ligne des contenus', en: 'Content upload', es: 'Carga de contenido' },
    description: {
      fr: '• Intégration manuelle des contenus fournis par le client, comme des fiches produits ou des projets portfolio\n• Mise en page simple dans les structures existantes\n• Contrôle visuel rapide après intégration',
      en: '• Manual upload of client-provided content, such as product listings or portfolio projects\n• Simple layout within the existing page structures\n• Quick visual check after integration',
      es: '• Integración manual del contenido facilitado por el cliente, como fichas de producto o proyectos de portfolio\n• Maquetación simple dentro de las estructuras existentes\n• Revisión visual rápida tras la integración',
    },
    price: 180,
    unitLabel: { fr: '15 items', en: '15 items', es: '15 items' },
  },
  {
    title: { fr: 'Guidance / optimisation copywriting site', en: 'Website copywriting guidance / optimisation', es: 'Guía / optimización de copywriting web' },
    description: {
      fr: '• Inclut :\n  • Homepage, About et Contact page copy (structure + sections clés)\n  • Product page copy (1 structure de page)\n  • Tone alignment\n  • 2 revision rounds\n  • Focus sur la clarté et la conversion\n• Exclut :\n  • Stratégie de marque complète\n  • Révisions illimitées',
      en: '• Includes:\n  • Homepage, About, Contact pages copy (structure + key sections)\n  • Product page copy (1 page structure)\n  • Tone alignment\n  • 2 revision rounds\n  • Focused on clarity and conversion\n• Excludes:\n  • Full brand strategy\n  • Unlimited revisions',
      es: '• Incluye:\n  • Copy de Homepage, About y Contact (estructura + secciones clave)\n  • Copy de product page (1 estructura de página)\n  • Alineación del tono\n  • 2 rondas de revisión\n  • Foco en claridad y conversión\n• Excluye:\n  • Estrategia de marca completa\n  • Revisiones ilimitadas',
    },
    price: 320,
  },
  {
    title: { fr: 'Page additionnelle', en: 'Additional page', es: 'Página adicional' },
    description: {
      fr: '• Design et développement d’une page supplémentaire alignée avec l’identité visuelle du site\n• Inclut le layout, l’intégration et une structuration de contenu de base',
      en: '• Design and development of an additional page aligned with the website’s visual identity\n• Includes layout, integration, and basic content structuring',
      es: '• Diseño y desarrollo de una página adicional alineada con la identidad visual del sitio\n• Incluye layout, integración y una estructuración básica del contenido',
    },
    price: 220,
  },
  {
    title: { fr: 'Setup email basique & drop', en: 'Basic email & drop setup', es: 'Setup básico email y drop' },
    description: {
      fr: '• Mise en place d’un flow email simple pour lancement produit ou nouveau drop\n• Structuration d’une capture d’audience de base et d’un scénario d’annonce\n• Inclut 1 email additionnel',
      en: '• Setup of a simple email flow for product launches or new drops\n• Structuring of a basic audience capture and announcement flow\n• Includes 1 additional email',
      es: '• Configuración de un flujo email simple para lanzamiento de producto o nuevo drop\n• Estructuración de una captación de audiencia básica y de un flujo de anuncio\n• Incluye 1 email adicional',
    },
    price: 180,
  },
  {
    title: { fr: 'Setup de flows d’automatisation', en: 'Automation flows setup', es: 'Setup de flujos de automatización' },
    description: {
      fr: '• Création et configuration de flows automatiques de base\n• Exemples : bienvenue, abandon de panier ou relance simple\n• Adapté selon le besoin et les outils déjà en place',
      en: '• Creation and setup of baseline automated flows\n• Examples: welcome flow, cart abandonment, or a simple follow-up\n• Adapted to the needs and the tools already in place',
      es: '• Creación y configuración de flujos automáticos básicos\n• Ejemplos: bienvenida, abandono de carrito o seguimiento simple\n• Adaptado según la necesidad y las herramientas ya en uso',
    },
    price: 260,
  },
];

const onboardingTemplates: Array<Omit<OnboardingTask, 'id' | 'status'>> = [
  {
    title: 'Clarifier les objectifs business',
    description: 'Objectifs du site, pages prioritaires, appels à l’action et résultat attendu.',
    category: 'strategy',
    required: true,
  },
  {
    title: 'Valider l’arborescence',
    description: 'Lister les pages, priorités de navigation, sections et contenus attendus.',
    category: 'strategy',
    required: true,
  },
  {
    title: 'Collecter les contenus finaux',
    description: 'Textes, visuels, témoignages, FAQ, éléments de réassurance et médias.',
    category: 'content',
    required: true,
  },
  {
    title: 'Rassembler les accès',
    description: 'Domaine, hébergement, CMS, analytics, emails, outils tiers et comptes utiles.',
    category: 'access',
    required: true,
  },
  {
    title: 'Valider l’identité visuelle',
    description: 'Logo, couleurs, typographies, références et règles de marque.',
    category: 'branding',
    required: true,
  },
  {
    title: 'Vérifier les mentions obligatoires',
    description: 'Mentions légales, confidentialité, cookies, CGV ou autres obligations.',
    category: 'legal',
    required: true,
  },
];

export const createDefaultQuoteConditions = (
  platform: ClientPlatform,
  language: QuoteLanguage,
  clientCountry: string = '',
): QuoteCondition[] =>
  createQuoteConditionTemplates(platform || 'other', clientCountry).map((condition) => ({
    id: createId(),
    title: pick(condition.title, language),
    body: pick(condition.body, language),
    items: bulletItemsFromCopy(pick(condition.body, language)),
  }));

export const createDefaultQuoteRoadmap = (
  platform: ClientPlatform,
  language: QuoteLanguage,
): QuoteCondition[] =>
  getQuoteRoadmapTemplates(platform || 'other').map((phase) => ({
    id: createId(),
    title: pick(phase.title, language),
    body: pick(phase.body, language),
    items: bulletItemsFromCopy(pick(phase.body, language)),
  }));

const acceptanceTemplates: Array<{ title: LocalizedCopy; body: LocalizedCopy }> = [
  {
    title: {
      fr: 'Acceptation de la proposition',
      en: 'Acceptance of proposal',
      es: 'Aceptación de la propuesta',
    },
    body: {
      fr: '• La signature de ce devis vaut acceptation de la proposition, du périmètre décrit et des conditions générales.\n• Un acompte de 50 % est demandé à la signature pour démarrer le projet.\n• Le solde est dû à la livraison finale, avant la mise en ligne.',
      en: '• Signing this quote constitutes acceptance of the proposal, the described scope and the general terms.\n• A 50% deposit is required upon signature to start the project.\n• The balance is due on final delivery, before going live.',
      es: '• La firma de este presupuesto implica la aceptación de la propuesta, del alcance descrito y de las condiciones generales.\n• Se solicita un anticipo del 50 % a la firma para iniciar el proyecto.\n• El saldo se abona en la entrega final, antes de la publicación.',
    },
  },
];

export const createDefaultQuoteAcceptance = (
  language: QuoteLanguage,
): QuoteCondition[] =>
  acceptanceTemplates.map((entry) => ({
    id: createId(),
    title: pick(entry.title, language),
    body: pick(entry.body, language),
    items: bulletItemsFromCopy(pick(entry.body, language)),
  }));

const principleTemplates: Array<{ title: LocalizedCopy; body: LocalizedCopy }> = [
  {
    title: {
      fr: 'Nos principes de collaboration',
      en: 'Our working principles',
      es: 'Nuestros principios de colaboración',
    },
    body: {
      fr: '• Communication claire et régulière tout au long du projet.\n• Processus itératif avec intégration progressive de vos retours.\n• Livrables validés étape par étape pour garantir la qualité.',
      en: '• Clear and regular communication throughout the project.\n• Iterative process with your feedback integrated progressively.\n• Deliverables validated step by step to ensure quality.',
      es: '• Comunicación clara y regular durante todo el proyecto.\n• Proceso iterativo con integración progresiva de tus comentarios.\n• Entregables validados paso a paso para garantizar la calidad.',
    },
  },
];

export const createDefaultQuotePrinciples = (
  language: QuoteLanguage,
): QuoteCondition[] =>
  principleTemplates.map((entry) => ({
    id: createId(),
    title: pick(entry.title, language),
    body: pick(entry.body, language),
    items: bulletItemsFromCopy(pick(entry.body, language)),
  }));

export const createAddonPresets = (language: QuoteLanguage): QuoteAddon[] =>
  addonTemplates.map((addon) => ({
    id: createId(),
    title: pick(addon.title, language),
    description: pick(addon.description, language),
    items: bulletItemsFromCopy(pick(addon.description, language)),
    price: addon.price,
    unitLabel: addon.unitLabel ? pick(addon.unitLabel, language) : '',
    enabled: true,
  }));

export const createBlankAddon = (): QuoteAddon => ({
  id: createId(),
  title: 'Nouvelle option',
  description: '',
  items: [],
  price: 0,
  unitLabel: '',
  enabled: true,
});

/**
 * Mail d'envoi standard par langue. Placeholders remplacés à la génération :
 * {client} = prénom du client, {titre} = titre du devis, {ref} = référence.
 */
export const quoteEmailPresets: Record<QuoteLanguage, { subject: string; body: string }> = {
  fr: {
    subject: 'Proposition de devis - {titre} ({ref})',
    body: `Bonjour {client},

Vous trouverez ci-joint le devis pour {titre}.

Si tout vous convient, vous pouvez simplement me le confirmer par retour d’email et je m’occuperai de la suite. Si vous souhaitez ajuster un point, je peux bien entendu mettre le devis à jour.

Bien à vous,`,
  },
  en: {
    subject: 'Quote proposal - {titre} ({ref})',
    body: `Hi {client},

Please find attached the quote for {titre}.

If everything looks good to you, you can simply confirm by replying to this email and I will take care of the next steps. If you would like to adjust anything, I can of course update the quote accordingly.

Kind regards,`,
  },
  es: {
    subject: 'Propuesta de presupuesto - {titre} ({ref})',
    body: `Hola {client},

Te adjunto el presupuesto para {titre}.

Si todo te encaja, puedes confirmármelo respondiendo a este correo y me encargaré de los siguientes pasos. Si quieres ajustar algún punto, por supuesto puedo actualizar el presupuesto.

Un saludo,`,
  },
};

export const createDefaultQuoteTemplateLocalizedContent = (
  platform: ClientPlatform,
  clientCountry: string = '',
): Record<QuoteLanguage, QuoteTemplateLocalizedContent> => {
  const build = (language: QuoteLanguage): QuoteTemplateLocalizedContent => ({
    projectSummary: '',
    emailSubject: '',
    emailBody: '',
    parts: [],
    conditions: createDefaultQuoteConditions(platform, language, clientCountry),
    roadmap: createDefaultQuoteRoadmap(platform, language),
    acceptance: createDefaultQuoteAcceptance(language),
    principles: createDefaultQuotePrinciples(language),
    addons: createAddonPresets(language),
    paymentSchedule: createDefaultPaymentSchedule(language),
  });
  return { fr: build('fr'), en: build('en'), es: build('es') };
};

export const createDefaultQuoteTemplate = (
  name: string = 'Template de devis',
  platform: ClientPlatform = 'shopify',
  language: QuoteLanguage = 'fr',
  clientCountry: string = '',
): QuoteTemplateInput => {
  const localizedContent = createDefaultQuoteTemplateLocalizedContent(platform, clientCountry);
  const activeContent = localizedContent[language];

  return {
    name,
    kind: 'custom',
    platform,
    customPlatformLabel: '',
    language,
    vatRate: 21,
    projectSummary: activeContent.projectSummary,
    emailSubject: activeContent.emailSubject,
    emailBody: activeContent.emailBody,
    discountType: 'percent',
    discountValue: 0,
    parts: activeContent.parts,
    conditions: activeContent.conditions,
    roadmap: activeContent.roadmap,
    acceptance: activeContent.acceptance,
    principles: activeContent.principles,
    addons: activeContent.addons,
    paymentSchedule: activeContent.paymentSchedule,
    localizedContent,
  };
};

export const createOnboardingTasks = (): OnboardingTask[] =>
  onboardingTemplates.map((task) => ({
    id: createId(),
    ...task,
    status: 'todo',
  }));

export const createClientProject = (name: string = 'Projet principal'): ClientProject => ({
  id: createId(),
  name,
  description: '',
  onboardingTasks: createOnboardingTasks(),
});
