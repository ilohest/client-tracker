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

- `views/` : une vue par page — `QuotesWorkspace.vue` (devis), `QuoteTemplatesWorkspace.vue` (templates), `ClientsWorkspace.vue` (clients), `Dashboard.vue`, `Profile.vue`, admin.
- `stores/` : Pinia options API (state/getters/actions) — `quotesStore`, `quoteTemplatesStore`, `clientsStore`, `authStore`.
- `services/` : appels Firestore (collections `quotes`, `quoteTemplates`, `clients`, `users`…), toujours filtrés par `userId`.
- `components/quotes/` : `QuoteBuilderForm` (gros formulaire partagé devis/template via prop `mode`), `QuoteActionBar` (barre d'action sticky partagée : Sauvegarder/Annuler/Dupliquer/Supprimer/PDF + indicateur non-sauvegardé), `QuoteListPanel`, éditeurs de sections/conditions/addons.
- `lib/clientPresets.ts` : contenu par défaut (conditions, roadmap, addons…) en fr/en/es.
- `utils/quote.ts` : calculs totaux/TVA/remise, versioning, refs devis ; `utils/quotePdf.ts` : génération PDF via fenêtre d'impression.

## Domaine

- **Devis (`Quote`)** : parties (`parts`) → sections → items ; conditions/roadmap/acceptance/principles ; addons ; statuts `draft → finalized → sent → accepted/refused/revision_requested/superseded` ; versioning via `versionGroupId` + `version`.
- **Templates de devis (`QuoteTemplate`)** : champ `kind` — `'base'` = **Base commune** (unique, protégée, non supprimable, épinglée en tête de bibliothèque) ; `'custom'` = templates de stack. Contenu localisé fr/en/es dans `localizedContent`.
- **Modèle de composition (pas de doublons)** : la base commune ne porte que le contenu transverse (**validation/acceptance + principes**) ; les templates de stack portent le contenu qui varie (plateforme, langue, description projet, parties, conditions, roadmap, add-ons). Un devis = base commune + template choisi. `QuoteBuilderForm` a trois modes : `quote` (tout), `template` (masque validation/principes), `base` (ne montre que nom, langue à modifier, validation, principes). Composition dans `QuotesWorkspace` : `getBaseCommonContent()` + `createDraftFromTemplate()` ; le changement de client/langue régénère via `applyStandardContent()`.

## Conventions

- Phase de développement : **remplacer l'ancien code directement, pas de couche de rétrocompatibilité** (une migration de données one-shot est OK).
- **Boutons PrimeVue : toujours passer le texte via la prop `label`** (+ icône via `<template #icon>`). Ne jamais mettre le texte en slot par défaut : PrimeVue ignore alors le slot icône et applique un style icon-only (texte décentré).
- Suppressions : toujours un `ConfirmDialog` (`useConfirm`) avant de supprimer devis/template/client.
- Colonnes de gauche (listes) : sticky — `xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto`.
- Titres de page : **non sticky** (sinon ils chevauchent les colonnes sticky), avec l'icône Material du menu dans une pastille `bg-primary/10 text-primary rounded-2xl p-2`.
- Les dropdowns de statut de devis rendent les tags colorés (`quoteStatusMeta[status].tagClass`) via les slots `#value`/`#option` du Select.
- Toasts PrimeVue pour tout feedback ; messages en français.
- Garde "modifications non sauvegardées" (`hasUnsavedChanges` comparé via JSON normalisé + `stripIds`) avant de changer de sélection.
