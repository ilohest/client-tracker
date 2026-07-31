# Devisio (client-tracker)

App mono-utilisatrice de gestion de clients et de devis pour freelance web (plateformes Shopify/Squarespace/Wix…). UI entièrement en **français**.

## Stack & structure

- **Monorepo npm workspaces** : `frontend/` (app) + `packages/contracts/` (schémas zod + types partagés, importés en **source** — pas de build).
- **Frontend** : Vue 3 `<script setup>` + TypeScript, Vite, Pinia, Vue Router, **PrimeVue 4** (thème + `pt`), **Tailwind CSS v4** (config dans `frontend/src/style.css` via `@theme`, pas de tailwind.config).
- **Backend** : Firebase (Firestore + Auth + Storage), accès direct depuis le front via `frontend/src/services/*`. Règles dans `firestore.rules`.
- Icônes : Material Symbols (`<span class="material-symbols-outlined">nom</span>`).

## Commandes

```bash
cd frontend
npx vue-tsc --noEmit -p tsconfig.app.json   # typecheck
npm run build                                # build (inclut vue-tsc)
npm run dev                                  # dev server Vite
```

## Architecture frontend

- `views/` : **une page index + une page détail par entité** — devis (`QuotesIndex` + `QuoteDetail`, routes `/quotes`, `/quotes/new`, `/quotes/:id`), projets (`ProjectsIndex` + `ProjectDetail`, `/projects` et `/projects/:id`), clients (`ClientsIndex` + `ClientDetail`, `/clients` et `/clients/:id`). Restent en workspace : `QuoteTemplatesWorkspace.vue`, `TimesheetsWorkspace.vue` (surface de saisie, pas une collection à parcourir), `Dashboard.vue`, `Profile.vue`, admin.
- `stores/` : Pinia options API (state/getters/actions) — `quotesStore`, `quoteTemplatesStore`, `clientsStore`, `authStore`.
- `services/` : appels Firestore (collections `quotes`, `quoteTemplates`, `clients`, `users`…), toujours filtrés par `userId`.
- `components/quotes/` : `QuoteBuilderForm` (gros formulaire partagé devis/template via prop `mode`), `QuoteActionBar` (barre d'action sticky, utilisée par les **templates** uniquement — la page détail devis a sa propre barre d'identité), `QuoteBlocksEditor` + `QuoteTableBlockEditor` (contenu des lignes), éditeurs de sections/conditions/addons.
- **Index ↔ détail (patron commun)** : l'état de liste (recherche, filtres, tri) vit **dans l'URL** et transite par un util dédié — `utils/quoteFilters.ts`, `utils/projectFilters.ts`, `utils/clientFilters.ts` — qui expose toujours `read<X>ListQuery` / `write<X>ListQuery` / `build<X>List`. L'index passe sa query à la page détail, qui s'en sert pour le pas-à-pas préc./suiv. (même ordre filtré que le tableau) et pour restaurer la liste au retour. La route est la source de vérité de la sélection : un id inconnu renvoie à l'index avec un toast. Chaque page détail a une **barre sticky d'identité** (retour, titre + tags, méta, stepper, statut, actions) qui absorbe le titre de page et la barre d'action ; ne jamais dupliquer ces éléments dans le contenu.
- **Devis uniquement** : garde « modifications non sauvegardées » = `onBeforeRouteLeave` à trois issues (quitter / rester / sauvegarder et quitter) + `beforeunload`. Le verrou de statut (`quoteStatusMeta[...].locked`) porte sur le statut **enregistré**, jamais sur celui en cours d'édition : passer un brouillon à « Envoyé » reste une sauvegarde ordinaire, et « Créer la vN » est une action secondaire explicite.
- **Tableaux d'index** : 6 colonnes max, tri par en-tête, chips de filtres actifs + « Tout effacer », pied avec compte et total filtré, ligne entièrement cliquable, kebab au survol, deux états vides distincts (aucune donnée vs aucun résultat). Une seule couleur d'alerte en plus des tags de statut : devis `sent` sans réponse >14 j en ambre, projet dont l'échéance est dépassée en rouge.
- `utils/projectFinance.ts` : calculs budget / encaissé / à facturer d'un projet (devis passés en argument, partagés index ↔ détail).
- `lib/clientPresets.ts` : contenu par défaut (conditions, roadmap, addons…) en fr/en/es.
- `utils/quote.ts` : calculs totaux/TVA/remise, versioning, refs devis ; `utils/quotePdf.ts` : génération PDF via fenêtre d'impression ; `utils/quoteBlocks.ts` : modèle de blocs (parsing du collage texte/HTML/TSV, règles markdown, sérialisation).

## Domaine

- **Devis (`Quote`)** : parties (`parts`) → lignes (`sections`) → **blocs** ; conditions/roadmap/acceptance/principles ; addons ; statuts `draft → finalized → sent → accepted/refused/revision_requested/superseded` ; versioning via `versionGroupId` + `version`.
- **Contenu d'une ligne = liste plate de blocs** (`QuoteBlock`) : `kind` ∈ `paragraph|bullet|numbered|heading|table`, `depth` 0→3 pour l'imbrication des listes (pas de tableaux imbriqués — Firestore l'interdit), `text`, et `table` pour les blocs tableau uniquement. Édition clavier dans `QuoteBlocksEditor` : Entrée coupe le bloc, Tab/Maj+Tab indente, Retour arrière en début de bloc désindente puis fusionne, et `- ` / `1. ` / `## ` convertissent le bloc à la frappe. Le collage reconstruit l'arborescence (HTML riche prioritaire, sinon texte indenté ; TSV/markdown → tableau).
- `part.displayStyle` : `flow` (blocs qui s'enchaînent) ou `framed` (chaque ligne = cellule bordée `.scope-cell` dans le PDF).
- **Templates de devis (`QuoteTemplate`)** : champ `kind` — `'base'` = **Base commune** (unique, protégée, non supprimable, épinglée en tête de bibliothèque) ; `'custom'` = templates de stack. Contenu localisé fr/en/es dans `localizedContent`.
- **Modèle de composition (pas de doublons)** : la base commune ne porte que le contenu transverse (**validation/acceptance + principes**) ; les templates de stack portent le contenu qui varie (plateforme, langue, description projet, parties, conditions, roadmap, add-ons). Un devis = base commune + template choisi. `QuoteBuilderForm` a trois modes : `quote` (tout), `template` (masque validation/principes), `base` (ne montre que nom, langue à modifier, validation, principes). Composition dans `QuoteDetail` : `getBaseCommonContent()` + `createDraftFromTemplate()` ; le changement de client/langue régénère via `applyStandardContent()`.

## Conventions

- Phase de développement : **remplacer l'ancien code directement, pas de couche de rétrocompatibilité** (une migration de données one-shot est OK).
- **Boutons PrimeVue : toujours passer le texte via la prop `label`** (+ icône via `<template #icon>`). Ne jamais mettre le texte en slot par défaut : PrimeVue ignore alors le slot icône et applique un style icon-only (texte décentré).
- Suppressions : toujours un `ConfirmDialog` (`useConfirm`) avant de supprimer devis/template/client.
- Colonnes de gauche (listes) : sticky — `xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto`.
- Titres de page : **non sticky** (sinon ils chevauchent les colonnes sticky), avec l'icône Material du menu dans une pastille `bg-primary/10 text-primary rounded-2xl p-2`.
- Les dropdowns de statut de devis rendent les tags colorés (`quoteStatusMeta[status].tagClass`) via les slots `#value`/`#option` du Select.
- Toasts PrimeVue pour tout feedback ; messages en français.
- Garde "modifications non sauvegardées" (`hasUnsavedChanges` comparé via JSON normalisé + `stripIds`) avant de changer de sélection.
