<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

// --- DATA STATIQUE (Générée par EJS) ---
const projectInfo = {
  name: 'client-tracker',
  version: '1.0.0',
  mode: 'Monorepo',
  builder: 'Vite 6 + Turbolink'
};

const stack = [
  // FRONTEND CORE
  { name: 'Vue.js', version: '3.5+', icon: 'computer', category: 'Frontend', url: 'https://vuejs.org', desc: 'Framework UI réactif' },
  { name: 'Vite', version: '6.0+', icon: 'bolt', category: 'Build', url: 'https://vitejs.dev', desc: 'Bundler ultra-rapide' },
  { name: 'Tailwind CSS', version: '4.0', icon: 'palette', category: 'Style', url: 'https://tailwindcss.com', desc: 'Utility-first CSS (V4 engine)' },
  { name: 'PrimeVue', version: '4.2+', icon: 'widgets', category: 'UI Lib', url: 'https://primevue.org', desc: 'Composants UI riches' },
  { name: 'Pinia', version: '2.3+', icon: 'database', category: 'State', url: 'https://pinia.vuejs.org', desc: 'Store management' },

  // BACKEND / INFRA
  
  { name: 'Firebase', version: '11.0+', icon: 'cloud', category: 'Infra', url: 'https://firebase.google.com/docs', desc: 'Auth, Firestore & Hosting' },

  // FEATURES OPTIONNELLES
  
  

  // TOOLS
  { name: 'TypeScript', version: '5.7+', icon: 'code', category: 'Lang', url: 'https://www.typescriptlang.org', desc: 'Typage statique strict' },
  { name: 'Zod', version: '3.22+', icon: 'check_circle', category: 'Validation', url: 'https://zod.dev', desc: 'Schéma validation (Shared)' },
];

const scripts = [
  
  { cmd: 'npm run dev', desc: 'Lance le serveur de développement', context: 'Frontend' },
  { cmd: 'npm run build', desc: 'Compile l\'application pour la prod', context: 'Frontend' },
  
  { cmd: 'npm run lint', desc: 'Vérifie la qualité du code (ESLint)', context: 'Global' },

];

const openLink = (url: string) => {
  window.open(url, '_blank');
};
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div
        class="md:col-span-2 bg-indigo-600 rounded-xl p-6 text-white shadow-lg flex flex-col justify-between relative overflow-hidden"
      >
        <div class="z-10">
          <h1 class="text-3xl font-bold mb-2">Documentation</h1>
          <p class="text-indigo-100 opacity-90">
            Référence technique pour <strong>{{ projectInfo.name }}</strong
            >. <br />Utilisez cette page pour retrouver les versions et
            commandes utiles.
          </p>
        </div>
        <div class="flex gap-2 mt-4 z-10">
          <Tag
            :value="projectInfo.mode"
            severity="info"
            class="!bg-white/20 !text-white border-0"
          />
          <Tag
            :value="'v' + projectInfo.version"
            severity="success"
            class="!bg-white/20 !text-white border-0"
          />
        </div>
        <span
          class="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-20 rotate-12"
        >menu_book</span>
      </div>

      <div
        class="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col justify-center gap-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"
          >
            <span class="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase font-bold">Status</p>
            <p class="font-bold text-gray-800">Opérationnel</p>
          </div>
        </div>
        <div class="h-px bg-gray-100 w-full"></div>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
          >
            <span class="material-symbols-outlined text-xl">code</span>
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase font-bold">Stack</p>
            <p class="font-bold text-gray-800">Fullstack TypeScript</p>
          </div>
        </div>
      </div>
    </div>

    <div
      class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      <Tabs value="0">
        <TabList>
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
                class="group p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-start gap-4"
                @click="openLink(tech.url)"
              >
                <div
                  class="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform"
                >
                  <span
                    class="material-symbols-outlined text-xl text-gray-600 group-hover:text-indigo-600"
                  >{{ tech.icon }}</span>
                </div>
                <div class="flex-1">
                  <div class="flex justify-between items-start">
                    <h3
                      class="font-bold text-gray-800 group-hover:text-indigo-700"
                    >
                      {{ tech.name }}
                    </h3>
                    <span
                      class="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono"
                      >{{ tech.version }}</span
                    >
                  </div>
                  <p class="text-xs text-gray-500 mt-1 leading-snug">
                    {{ tech.desc }}
                  </p>
                </div>
                <span
                  class="material-symbols-outlined text-xs text-gray-300 group-hover:text-indigo-300"
                >open_in_new</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="1">
            <div class="flex flex-col gap-0 divider-y divide-gray-100">
              <div
                v-for="script in scripts"
                :key="script.cmd"
                class="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 transition-colors gap-3"
              >
                <div class="flex items-center gap-4">
                  <span
                    class="w-20 text-[10px] uppercase font-bold text-gray-400 text-center border border-gray-200 rounded px-1 py-0.5"
                  >
                    {{ script.context }}
                  </span>
                  <code
                    class="font-mono text-sm bg-slate-800 text-green-400 px-3 py-1.5 rounded-md select-all"
                  >
                    {{ script.cmd }}
                  </code>
                </div>
                <span class="text-sm text-gray-600">{{ script.desc }}</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="2">
            <div
              class="prose prose-sm prose-indigo max-w-none p-2 text-gray-600"
            >
              <h3 class="text-gray-800">Structure du Monorepo</h3>
              <p>
                Ce projet utilise les <strong>NPM Workspaces</strong> pour
                partager du code et des types entre le Frontend et le Backend.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 class="flex items-center gap-2 m-0 mb-3 text-gray-800">
                    <span class="material-symbols-outlined text-yellow-500">folder</span>
                    packages/contracts
                  </h4>
                  <ul class="text-xs space-y-2 mb-0">
                    <li>
                      📦 Contient les schémas <strong>Zod</strong> partagés.
                    </li>
                    <li>🔄 Sert de "Source of Truth" pour l'API.</li>
                    <li>
                      ✅ Assure que le Frontend envoie ce que le Backend attend.
                    </li>
                  </ul>
                </div>

                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 class="flex items-center gap-2 m-0 mb-3 text-gray-800">
                    <span class="material-symbols-outlined text-green-500">folder</span> frontend
                  </h4>
                  <ul class="text-xs space-y-2 mb-0">
                    <li>🚀 Application <strong>Vue 3</strong>.</li>
                    <li>
                      🎨 Utilise <strong>Tailwind v4</strong> et PrimeVue.
                    </li>
                    <li>
                      📡 Communique avec l'API via le client RPC Hono
                      (Type-safe).
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
