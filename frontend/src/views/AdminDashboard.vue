<!-- AdminDashboard.vue -->

<script setup lang="ts">
  import { useRouter } from "vue-router";

  const router = useRouter();
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-start gap-3">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        <span class="material-symbols-outlined text-2xl text-primary">admin_panel_settings</span>
      </span>
      <div>
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Administration Système</h1>
        <p class="mt-1 text-sm text-surface-dark/55">
          Gestion technique et configuration de l'application.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
