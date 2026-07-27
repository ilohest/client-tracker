<script setup lang="ts">
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const toast = useToast();

// --- DATA STATIQUE ---
const projectInfo = {
  name: 'Devisio',
  version: '1.0.0',
  mode: 'Monorepo (npm workspaces)',
  builder: 'Vite 6'
};

const stack = [
  // FRONTEND CORE
  { name: 'Vue.js', version: '3.5+', icon: 'computer', category: 'Frontend', url: 'https://vuejs.org', desc: 'Framework UI réactif' },
  { name: 'Vite', version: '6.1+', icon: 'bolt', category: 'Build', url: 'https://vitejs.dev', desc: 'Bundler ultra-rapide' },
  { name: 'Tailwind CSS', version: '4.0', icon: 'palette', category: 'Style', url: 'https://tailwindcss.com', desc: 'Utility-first CSS (V4 engine)' },
  { name: 'PrimeVue', version: '4.2+', icon: 'widgets', category: 'UI Lib', url: 'https://primevue.org', desc: 'Composants UI riches' },
  { name: 'Pinia', version: '2.3+', icon: 'database', category: 'State', url: 'https://pinia.vuejs.org', desc: 'Store management' },

  // BACKEND / INFRA
  { name: 'Firebase', version: '11.3+', icon: 'cloud', category: 'Infra', url: 'https://firebase.google.com/docs', desc: 'Auth, Firestore & Storage' },

  // TOOLS
  { name: 'TypeScript', version: '5.7+', icon: 'code', category: 'Lang', url: 'https://www.typescriptlang.org', desc: 'Typage statique strict' },
  { name: 'Zod', version: '3.23+', icon: 'check_circle', category: 'Validation', url: 'https://zod.dev', desc: 'Schéma validation (Shared)' },
];

const scripts = [
  { cmd: 'npm run dev', desc: 'Lance le serveur de développement Vite', context: 'Racine' },
  { cmd: 'npm run build', desc: 'Typecheck (vue-tsc) + build de production', context: 'Racine' },
  { cmd: 'npx vue-tsc --noEmit -p tsconfig.app.json', desc: 'Vérifie les types sans compiler', context: 'frontend/' },
  { cmd: 'npm run create-admin', desc: 'Crée ou promeut un utilisateur admin (Auth + Firestore)', context: 'Racine' },
  { cmd: 'firebase deploy', desc: 'Déploie les règles Firestore & Storage', context: 'Racine' },
  { cmd: 'bash scripts/deploy-devisio.sh', desc: 'Build + déploiement sur le VPS (devisio.isaure-lohest.com)', context: 'Déploiement' },
];

const openLink = (url: string) => {
  window.open(url, '_blank');
};

const copyCommand = async (cmd: string) => {
  try {
    await navigator.clipboard.writeText(cmd);
    toast.add({ severity: 'info', summary: 'Copié', detail: 'Commande copiée dans le presse-papier.', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de copier la commande.', life: 2500 });
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-start gap-3">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        <span class="material-symbols-outlined text-2xl text-primary">menu_book</span>
      </span>
      <div>
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Documentation</h1>
        <p class="mt-1 text-sm text-surface-dark/55">
          Référence technique pour <strong>{{ projectInfo.name }}</strong> · versions et commandes utiles.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">Statut</p>
        <p class="mt-2 flex items-center gap-2 text-lg font-bold text-surface-dark">
          <span class="material-symbols-outlined text-xl text-emerald-500">check_circle</span>
          Opérationnel
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">Stack</p>
        <p class="mt-2 text-lg font-bold text-surface-dark">100% TypeScript</p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">{{ projectInfo.mode }}</p>
        <p class="mt-2 text-lg font-bold text-surface-dark">v{{ projectInfo.version }} · {{ projectInfo.builder }}</p>
      </div>
    </div>

    <div class="rounded-3xl border border-surface-dark/5 bg-surface-card overflow-hidden">
      <Tabs value="0">
        <TabList v-if="authStore.isAdmin">
          <Tab value="0">Technologies</Tab>
          <Tab value="1">Commandes</Tab>
          <Tab value="2">Architecture</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <div
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2"
            >
              <div
                v-for="tech in stack"
                :key="tech.name"
                class="group p-4 rounded-2xl border border-surface-dark/8 hover:border-primary/25 hover:bg-primary/5 transition-all cursor-pointer flex items-start gap-4"
                @click="openLink(tech.url)"
              >
                <div
                  class="w-10 h-10 rounded-lg bg-surface-dark/[0.035] group-hover:bg-white flex items-center justify-center shadow-sm border border-surface-dark/8 group-hover:scale-110 transition-transform"
                >
                  <span
                    class="material-symbols-outlined text-xl text-surface-dark/60 group-hover:text-primary"
                  >{{ tech.icon }}</span>
                </div>
                <div class="flex-1">
                  <div class="flex justify-between items-start">
                    <h3
                      class="font-bold text-surface-dark group-hover:text-primary"
                    >
                      {{ tech.name }}
                    </h3>
                    <span
                      class="text-[10px] bg-surface-dark/8 px-1.5 py-0.5 rounded text-surface-dark/55 font-mono"
                      >{{ tech.version }}</span
                    >
                  </div>
                  <p class="text-xs text-surface-dark/50 mt-1 leading-snug">
                    {{ tech.desc }}
                  </p>
                </div>
                <span
                  class="material-symbols-outlined text-xs text-surface-dark/25 group-hover:text-primary/50"
                >open_in_new</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel v-if="authStore.isAdmin" value="1">
            <div class="flex flex-col gap-0 divide-y divide-surface-dark/6">
              <div
                v-for="script in scripts"
                :key="script.cmd"
                class="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-surface-dark/[0.02] transition-colors gap-3"
              >
                <div class="flex items-center gap-4">
                  <span
                    class="w-20 text-[10px] uppercase font-bold text-surface-dark/40 text-center border border-surface-dark/10 rounded px-1 py-0.5"
                  >
                    {{ script.context }}
                  </span>
                  <code
                    class="group/cmd flex cursor-pointer items-center gap-2 font-mono text-sm bg-surface-dark text-emerald-400 px-3 py-1.5 rounded-md transition-colors hover:bg-surface-dark/85"
                    title="Copier la commande"
                    @click="copyCommand(script.cmd)"
                  >
                    {{ script.cmd }}
                    <span class="material-symbols-outlined text-sm text-emerald-400/50 group-hover/cmd:text-emerald-400">content_copy</span>
                  </code>
                </div>
                <span class="text-sm text-surface-dark/60">{{ script.desc }}</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel v-if="authStore.isAdmin" value="2">
            <div
              class="prose prose-sm max-w-none p-2 text-surface-dark/70"
            >
              <h3 class="text-surface-dark font-heading">Structure du Monorepo</h3>
              <p>
                Ce projet utilise les <strong>NPM Workspaces</strong> : le
                Frontend accède directement à Firebase, sans backend
                intermédiaire, en s'appuyant sur des schémas partagés pour
                garder le typage et la validation cohérents de bout en bout.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div class="bg-surface-dark/[0.03] rounded-2xl p-4 border border-surface-dark/8">
                  <h4 class="flex items-center gap-2 m-0 mb-3 text-surface-dark font-heading">
                    <span class="material-symbols-outlined text-amber-500">folder</span>
                    packages/contracts
                  </h4>
                  <ul class="text-xs space-y-2 mb-0">
                    <li>
                      📦 Contient les schémas <strong>Zod</strong> partagés, importés en source (pas de build).
                    </li>
                    <li>🔄 Sert de "Source of Truth" pour la forme des documents Firestore.</li>
                    <li>
                      ✅ Valide les données à l'écriture comme à la lecture.
                    </li>
                  </ul>
                </div>

                <div class="bg-surface-dark/[0.03] rounded-2xl p-4 border border-surface-dark/8">
                  <h4 class="flex items-center gap-2 m-0 mb-3 text-surface-dark font-heading">
                    <span class="material-symbols-outlined text-emerald-500">folder</span> frontend
                  </h4>
                  <ul class="text-xs space-y-2 mb-0">
                    <li>🚀 Application <strong>Vue 3</strong> (Vite, Pinia, Vue Router).</li>
                    <li>
                      🎨 Utilise <strong>Tailwind v4</strong> et PrimeVue.
                    </li>
                    <li>
                      📡 Accède directement à Firestore via les services
                      (<code>src/services/*</code>), sans API intermédiaire.
                    </li>
                  </ul>
                </div>

                <div class="bg-surface-dark/[0.03] rounded-2xl p-4 border border-surface-dark/8">
                  <h4 class="flex items-center gap-2 m-0 mb-3 text-surface-dark font-heading">
                    <span class="material-symbols-outlined text-primary">local_fire_department</span> Firebase
                  </h4>
                  <ul class="text-xs space-y-2 mb-0">
                    <li>🔐 <strong>Auth</strong> pour la connexion et la vérification d'email.</li>
                    <li>🗄️ <strong>Firestore</strong> pour les données, toujours filtrées par <code>userId</code>.</li>
                    <li>
                      🛡️ Règles de sécurité dans <code>firestore.rules</code> / <code>storage.rules</code>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>
