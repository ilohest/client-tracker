import type { ClientPlatform, ClientProject, ClientStage, OnboardingTask, QuoteAddon, QuoteCondition, QuoteConditionItem, QuoteDiscountType, QuoteLanguage, QuoteSection, QuoteStatus, VatRate } from '@client-tracker/contracts';
import { isEuroCountry } from '@/lib/countries';

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type LocalizedCopy = Record<QuoteLanguage, string>;

const pick = (copy: LocalizedCopy, language: QuoteLanguage): string => copy[language];

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

type PlatformTemplateKey = Exclude<ClientPlatform, ''>;

export const languageOptions: Array<{ label: string; value: QuoteLanguage }> = [
  { label: 'Français', value: 'fr' },
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
];

export const vatOptions: Array<{ label: string; value: VatRate }> = [
  { label: 'TVA 21%', value: 21 },
  { label: 'TVA 0%', value: 0 },
];

export const quoteStatusOptions: Array<{ label: string; value: QuoteStatus }> = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Envoyé', value: 'sent' },
  { label: 'Accepté', value: 'accepted' },
  { label: 'Refusé', value: 'refused' },
];

export const discountTypeOptions: Array<{ label: string; value: QuoteDiscountType }> = [
  { label: 'Pourcentage', value: 'percent' },
  { label: 'Montant fixe', value: 'fixed' },
];

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

type LocalizedSectionTemplate = {
  title: LocalizedCopy;
  description: LocalizedCopy;
  price: number;
  subSections?: Array<{
    title: LocalizedCopy;
    body: LocalizedCopy;
  }>;
};

const quoteSectionTemplates: Record<PlatformTemplateKey, LocalizedSectionTemplate[]> = {
  shopify: [
    {
      title: { fr: '1. Design & expérience utilisateur', en: '1. Design & user experience', es: '1. Diseño y experiencia de usuario' },
      description: {
        fr: '• Sélection d’un thème Shopify aligné sur les besoins du projet\n• Direction visuelle personnalisée adaptée à ton univers\n• Affinage du layout, de la hiérarchie et de la navigation pour améliorer l’expérience utilisateur\n• Ajustements continus sur base des retours tout au long du projet\n• L’objectif n’est pas seulement esthétique: créer une expérience claire et intentionnelle qui soutient ton activité',
        en: '• Selection of a Shopify theme aligned with the project\'s needs\n• Custom visual direction adapted to your artistic universe\n• Refinement of layout, hierarchy, and navigation to improve user experience\n• Ongoing adjustments based on feedback throughout the project\n• The focus is not only on aesthetics, but on creating a clear and intentional experience that supports your work and drives engagement.',
        es: '• Selección de un tema Shopify alineado con las necesidades del proyecto\n• Dirección visual personalizada adaptada a tu universo\n• Refinamiento del layout, la jerarquía y la navegación para mejorar la experiencia de usuario\n• Ajustes continuos a partir del feedback durante el proyecto\n• El objetivo no es solo estético: crear una experiencia clara e intencional que apoye tu actividad',
      },
      price: 950,
    },
    {
      title: { fr: '2. Développement & setup Shopify', en: '2. Development & Shopify setup', es: '2. Desarrollo y configuración Shopify' },
      description: {
        fr: 'Mise en place de la boutique, des pages clés, des paramètres e-commerce et des fondations techniques Shopify.',
        en: 'Store setup, key pages, e-commerce settings, and the technical Shopify foundations.',
        es: 'Configuración de la tienda, páginas clave, ajustes e-commerce y bases técnicas de Shopify.',
      },
      price: 1850,
      subSections: [
        {
          title: { fr: 'Setup boutique', en: 'Store setup', es: 'Configuración de tienda' },
          body: {
            fr: '• Configuration initiale Shopify: devise, paiements, livraison et paramètres de base\n• Installation du thème et setup technique\n• Pour une audience internationale, une attention particulière est portée à la configuration des paiements et des devises pendant la phase d’analyse',
            en: '• Initial Shopify configuration (currency, payments, shipping, basic settings)\n• Theme installation and technical setup\n• Note: given your international audience and India-based setup, particular attention will be given to payment configuration and currency handling during the analysis phase',
            es: '• Configuración inicial de Shopify: moneda, pagos, envíos y ajustes básicos\n• Instalación del tema y configuración técnica\n• Para una audiencia internacional, se presta especial atención a la configuración de pagos y divisas durante la fase de análisis',
          },
        },
        {
          title: { fr: 'Customisation & développement des pages', en: 'Customisation & page development', es: 'Personalización y desarrollo de páginas' },
          body: {
            fr: '• Customisation visuelle complète: couleurs, typographies, layout et branding\n• Développement jusqu’à 4 pages clés: Accueil, Work / Portfolio, Shop, Produit\n• Mise en place des pages essentielles: mentions légales, panier, checkout, compte client\n• Configuration des collections, filtres, navigation, tunnel et fonctionnalités promotionnelles de base',
            en: '• Full visual customization (colors, typography, layout, branding elements)\n• Development of up to 4 key pages: Home, Work / Portfolio, Shop, Product\n• Setup of essential pages (legal pages, cart, checkout, customer account)\n• Product and collection setup, including store structure, filters and navigation\n• Configuration of payments, shipping rules, and basic promotional features',
            es: '• Personalización visual completa: colores, tipografías, layout y branding\n• Desarrollo de hasta 4 páginas clave: Home, Work / Portfolio, Shop, Product\n• Implementación de páginas esenciales: legales, carrito, checkout y cuenta cliente\n• Configuración de colecciones, filtros, navegación y funciones promocionales básicas',
          },
        },
        {
          title: { fr: 'Capture email & automatisations simples', en: 'Email capture & simple automations', es: 'Captación email y automatizaciones simples' },
          body: {
            fr: '• Mise en place d’une capture newsletter simple en footer ou dans une section dédiée',
            en: '• Simple newsletter signup (footer)',
            es: '• Implementación de una captación newsletter simple en footer o sección dedicada',
          },
        },
        {
          title: { fr: 'SEO', en: 'SEO', es: 'SEO' },
          body: {
            fr: '• Mise en place de la structure SEO de base',
            en: '• Basic structure setup',
            es: '• Configuración de la estructura SEO base',
          },
        },
      ],
    },
    {
      title: { fr: '3. Tests & mise en ligne', en: '3. Testing & launch', es: '3. Testing y lanzamiento' },
      description: {
        fr: '• Vérifications responsive et contrôle qualité final\n• Tests de navigation, d’expérience d’achat et des points critiques\n• Ajustements avant livraison et préparation de la mise en ligne',
        en: '• Responsive checks and final quality control\n• Testing of navigation, shopping flow, and critical touchpoints\n• Final adjustments before delivery and launch preparation',
        es: '• Verificaciones responsive y control de calidad final\n• Tests de navegación, flujo de compra y puntos críticos\n• Ajustes finales antes de la entrega y del lanzamiento',
      },
      price: 420,
    },
  ],
  wordpress: [
    {
      title: { fr: 'Conception WordPress', en: 'WordPress implementation', es: 'Implementación WordPress' },
      description: {
        fr: 'Configuration du thème, structure des pages, responsive et paramétrages essentiels.',
        en: 'Theme setup, page structure, responsive implementation, and core settings.',
        es: 'Configuración del tema, estructura de páginas, responsive y ajustes esenciales.',
      },
      price: 1700,
    },
    {
      title: { fr: 'Extensions & optimisation', en: 'Plugins & optimisation', es: 'Plugins y optimización' },
      description: {
        fr: 'Mise en place des extensions utiles, optimisation des performances et sécurité de base.',
        en: 'Useful plugin setup, performance optimisation, and baseline security.',
        es: 'Configuración de plugins útiles, optimización de rendimiento y seguridad básica.',
      },
      price: 520,
    },
  ],
  webflow: [
    {
      title: { fr: 'Conception Webflow', en: 'Webflow implementation', es: 'Implementación Webflow' },
      description: {
        fr: 'Construction des pages, animations utiles, CMS Webflow et responsive complet.',
        en: 'Page building, meaningful animations, Webflow CMS setup, and full responsiveness.',
        es: 'Construcción de páginas, animaciones útiles, CMS Webflow y responsive completo.',
      },
      price: 1900,
    },
    {
      title: { fr: 'CMS & SEO', en: 'CMS & SEO setup', es: 'CMS y SEO' },
      description: {
        fr: 'Structuration des collections CMS, métadonnées et bonnes pratiques SEO on-page.',
        en: 'CMS collection structure, metadata, and on-page SEO best practices.',
        es: 'Estructuración de colecciones CMS, metadatos y buenas prácticas SEO on-page.',
      },
      price: 480,
    },
  ],
  squarespace: [
    {
      title: { fr: 'Configuration Squarespace', en: 'Squarespace setup', es: 'Configuración Squarespace' },
      description: {
        fr: 'Construction des pages, adaptation du template, responsive et paramétrages principaux.',
        en: 'Page building, template adaptation, responsive work, and core settings.',
        es: 'Construcción de páginas, adaptación del template, responsive y ajustes principales.',
      },
      price: 1400,
    },
    {
      title: { fr: 'SEO & contenus', en: 'SEO & content setup', es: 'SEO y contenidos' },
      description: {
        fr: 'Intégration des contenus, optimisations on-page et préparation des métadonnées.',
        en: 'Content integration, on-page optimisation, and metadata preparation.',
        es: 'Integración de contenidos, optimización on-page y preparación de metadatos.',
      },
      price: 450,
    },
  ],
  custom: [
    {
      title: { fr: 'Design & intégration sur mesure', en: 'Custom design & development', es: 'Diseño y desarrollo a medida' },
      description: {
        fr: 'Architecture front-end, composants, responsive et intégration de l’interface.',
        en: 'Front-end architecture, components, responsive behavior, and UI integration.',
        es: 'Arquitectura front-end, componentes, responsive e integración de la interfaz.',
      },
      price: 2600,
    },
    {
      title: { fr: 'Recette & mise en ligne', en: 'QA & launch', es: 'QA y lanzamiento' },
      description: {
        fr: 'Tests, corrections, préparation du déploiement et accompagnement au lancement.',
        en: 'Testing, fixes, launch preparation, and go-live support.',
        es: 'Tests, correcciones, preparación del despliegue y apoyo al lanzamiento.',
      },
      price: 900,
    },
  ],
  other: [
    {
      title: { fr: 'Prestation web', en: 'Web project delivery', es: 'Entrega de proyecto web' },
      description: {
        fr: 'Cadrage, exécution, coordination et livraison de la prestation selon le besoin client.',
        en: 'Scoping, execution, coordination, and delivery according to the client needs.',
        es: 'Definición, ejecución, coordinación y entrega según las necesidades del cliente.',
      },
      price: 1500,
    },
  ],
};

const getPlatformSpecificCondition = (platform: ClientPlatform): LocalizedCopy => {
  switch (platform) {
    case 'shopify':
      return {
        fr: 'La prestation s’appuie sur les capacités natives de Shopify et sur le thème retenu. Les applications tierces, abonnements, licences premium, frais Shopify, passerelles de paiement et coûts récurrents éventuels ne sont pas inclus sauf mention explicite dans le devis.',
        en: 'The delivery relies on Shopify native capabilities and the selected theme. Third-party apps, subscriptions, premium licenses, Shopify fees, payment gateways, and any recurring costs are excluded unless explicitly stated in the quote.',
        es: 'La prestación se basa en las capacidades nativas de Shopify y en el tema seleccionado. Las apps de terceros, suscripciones, licencias premium, comisiones de Shopify, pasarelas de pago y costes recurrentes no están incluidos salvo mención expresa en el presupuesto.',
      };
    case 'wordpress':
      return {
        fr: 'La prestation repose sur WordPress, le thème et les extensions validés au cadrage. Les licences premium, renouvellements, hébergement, maintenance, services tiers et développements hors périmètre restent à charge du client sauf mention contraire.',
        en: 'The delivery is based on WordPress, the agreed theme, and the plugins approved during scoping. Premium licenses, renewals, hosting, maintenance, third-party services, and out-of-scope development remain the client’s responsibility unless stated otherwise.',
        es: 'La prestación se basa en WordPress, el tema acordado y los plugins validados durante el alcance. Licencias premium, renovaciones, hosting, mantenimiento, servicios de terceros y desarrollos fuera de alcance corren por cuenta del cliente salvo indicación contraria.',
      };
    case 'webflow':
      return {
        fr: 'La prestation repose sur les capacités natives de Webflow, son CMS et des interactions raisonnables. Les limites techniques propres à Webflow, les plans payants, l’hébergement, la localisation avancée ou des logiques métier spécifiques peuvent nécessiter un chiffrage complémentaire.',
        en: 'The delivery relies on Webflow native capabilities, its CMS, and reasonable interactions. Webflow-specific technical limits, paid plans, hosting, advanced localisation, or custom business logic may require an additional quote.',
        es: 'La prestación se basa en las capacidades nativas de Webflow, su CMS y unas interacciones razonables. Los límites técnicos de Webflow, planes de pago, hosting, localización avanzada o lógica de negocio específica pueden requerir un presupuesto adicional.',
      };
    case 'squarespace':
      return {
        fr: 'La prestation s’appuie sur les capacités natives de Squarespace et sur des ajustements front-end raisonnables. Toute personnalisation avancée, intégration tierce ou besoin dépassant les possibilités du template validé peut faire l’objet d’un complément.',
        en: 'The delivery relies on native Squarespace capabilities and reasonable front-end adjustments. Advanced customisation, third-party integrations, or needs beyond the validated template scope may require an additional quote.',
        es: 'La prestación se basa en las capacidades nativas de Squarespace y en ajustes front-end razonables. Cualquier personalización avanzada, integración de terceros o necesidad fuera del alcance del template validado puede requerir un complemento.',
      };
    case 'custom':
      return {
        fr: 'Pour un projet sur mesure, seules les fonctionnalités, intégrations et livrables explicitement décrits dans le devis sont inclus. Toute demande complémentaire, nouvelle logique métier ou extension de périmètre fera l’objet d’un accord et d’un chiffrage additionnels.',
        en: 'For a custom project, only the features, integrations, and deliverables explicitly described in the quote are included. Any additional request, new business logic, or scope extension will require approval and an extra estimate.',
        es: 'Para un proyecto a medida, solo se incluyen las funcionalidades, integraciones y entregables descritos explícitamente en el presupuesto. Cualquier solicitud adicional, nueva lógica de negocio o ampliación de alcance requerirá validación y presupuesto extra.',
      };
    default:
      return {
        fr: 'La prestation couvre exclusivement le périmètre décrit dans le devis. Toute demande technique, fonctionnelle ou créative non explicitement incluse fera l’objet d’une validation et, si nécessaire, d’un complément budgétaire.',
        en: 'The delivery only covers the scope described in the quote. Any technical, functional, or creative request not explicitly included will require approval and, if necessary, an additional budget.',
        es: 'La prestación cubre únicamente el alcance descrito en el presupuesto. Cualquier solicitud técnica, funcional o creativa no incluida expresamente requerirá validación y, si procede, un presupuesto adicional.',
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

const addonTemplates: Array<{ title: LocalizedCopy; description: LocalizedCopy; price: number }> = [
  {
    title: { fr: 'Support horaire - pack 5 heures', en: 'Hourly support - 5-hour pack', es: 'Soporte por horas - pack 5 horas' },
    description: {
      fr: '• Valable 12 mois\n• Accompagnement ponctuel, ajustements, optimisations ou support client\n• Tarif horaire indicatif : 48,00 EUR / h',
      en: '• Valid for 12 months\n• Ongoing support, adjustments, optimisations or client assistance\n• Indicative hourly rate: EUR 48.00 / h',
      es: '• Válido durante 12 meses\n• Soporte puntual, ajustes, optimizaciones o asistencia al cliente\n• Tarifa horaria orientativa: 48,00 EUR / h',
    },
    price: 240,
  },
  {
    title: { fr: 'Support horaire - pack 10 heures', en: 'Hourly support - 10-hour pack', es: 'Soporte por horas - pack 10 horas' },
    description: {
      fr: '• Valable 12 mois\n• Accompagnement ponctuel, ajustements, optimisations ou support client\n• Tarif horaire indicatif : 45,00 EUR / h',
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
      fr: '• Intégration manuelle des contenus fournis par le client\n• Mise en page simple dans les gabarits existants\n• Contrôle visuel rapide après intégration',
      en: '• Manual upload of client-provided content\n• Simple layout within the existing templates\n• Quick visual check after integration',
      es: '• Integración manual del contenido facilitado por el cliente\n• Maquetación simple dentro de las plantillas existentes\n• Revisión visual rápida tras la integración',
    },
    price: 180,
  },
  {
    title: { fr: 'Guidance / optimisation copywriting site', en: 'Website copywriting guidance / optimisation', es: 'Guía / optimización de copywriting web' },
    description: {
      fr: '• Inclut :\n  • Homepage, About et Contact page copy (structure + sections clés)\n  • Product page copy (1 template)\n  • Tone alignment\n  • 2 revision rounds\n  • Focus sur la clarté et la conversion\n• Exclut :\n  • Stratégie de marque complète\n  • Révisions illimitées',
      en: '• Includes:\n  • Homepage, About, Contact pages copy (structure + key sections)\n  • Product page copy (1 template)\n  • Tone alignment\n  • 2 revision rounds\n  • Focused on clarity and conversion\n• Excludes:\n  • Full brand strategy\n  • Unlimited revisions',
      es: '• Incluye:\n  • Copy de Homepage, About y Contact (estructura + secciones clave)\n  • Copy de product page (1 template)\n  • Alineación del tono\n  • 2 rondas de revisión\n  • Foco en claridad y conversión\n• Excluye:\n  • Estrategia de marca completa\n  • Revisiones ilimitadas',
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
      fr: '• Mise en place d’un flow email simple pour lancement produit ou nouveau drop\n• Structuration d’une capture d’audience de base et d’un scénario d’annonce\n• Inclut 1 template email additionnel',
      en: '• Setup of a simple email flow for product launches or new drops\n• Structuring of a basic audience capture and announcement flow\n• Includes 1 additional email template',
      es: '• Configuración de un flujo email simple para lanzamiento de producto o nuevo drop\n• Estructuración de una captación de audiencia básica y de un flujo de anuncio\n• Incluye 1 plantilla email adicional',
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

export const createDefaultQuoteSections = (
  platform: ClientPlatform,
  language: QuoteLanguage,
): QuoteSection[] =>
  quoteSectionTemplates[(platform || 'other') as PlatformTemplateKey].map((section) => ({
    id: createId(),
    title: pick(section.title, language),
    description: pick(section.description, language),
    price: section.price,
    subSections: (section.subSections || []).map((subSection) => ({
      id: createId(),
      title: pick(subSection.title, language),
      body: pick(subSection.body, language),
    })),
  }));

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

export const createAddonPresets = (language: QuoteLanguage): QuoteAddon[] =>
  addonTemplates.map((addon) => ({
    id: createId(),
    title: pick(addon.title, language),
    description: pick(addon.description, language),
    items: bulletItemsFromCopy(pick(addon.description, language)),
    price: addon.price,
    enabled: true,
  }));

export const createBlankAddon = (): QuoteAddon => ({
  id: createId(),
  title: 'Nouvel add-on',
  description: '',
  items: [],
  price: 0,
  enabled: true,
});

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
