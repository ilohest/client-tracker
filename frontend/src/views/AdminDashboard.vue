<!-- AdminDashboard.vue -->

<script setup lang="ts">
  import { useRouter } from "vue-router";
  import ConfigurationWidget from "../components/widgets/ConfigurationWidget.vue";
  

  const router = useRouter();
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Administration Système</h1>
      <p class="text-slate-500 text-sm">
        Gestion technique et configuration de l'application.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="col-span-1 min-h-[220px]">
        <ConfigurationWidget />
      </div>

        
      <div
        class="col-span-1 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between cursor-pointer hover:border-primary-200 hover:shadow-md transition-all group min-h-[220px]"
        @click="router.push({ name: 'admin-users' })"
      >
        <div class="flex justify-between items-start">
          <div class="p-3 bg-indigo-50 text-indigo-500 rounded-2xl w-fit">
            <span class="material-symbols-outlined">group</span>
          </div>
        </div>
        <div>
          <h4 class="text-slate-800 font-bold text-lg">Utilisateurs</h4>
          <p class="text-slate-500 text-xs mt-1">Gérer les comptes et accès</p>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <span
            class="text-xs text-indigo-500 font-bold flex items-center gap-1"
          >
            Gérer <span class="material-symbols-outlined text-[10px]">arrow_forward</span>
          </span>
        </div>
      </div>
      
    </div>
  </div>
</template>
