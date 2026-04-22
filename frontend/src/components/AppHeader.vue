<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";


import { useAuthStore, type UserProfile } from "../stores/authStore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";


const router = useRouter();


const authStore = useAuthStore();

const isAdmin = computed(() => authStore.userProfile?.role === 'admin');

const userDisplayName = computed(() => {
  if (!authStore.user) return "";
  return (
    authStore.userProfile?.displayName ||
    authStore.user?.displayName ||
    authStore.user?.email ||
    "Utilisateur"
  );
});

onMounted(() => {
  if (authStore.user) {
    const userRef = doc(db, "users", authStore.user.uid);
    onSnapshot(userRef, (snap) => {
      if (snap.exists()) authStore.userProfile = snap.data() as UserProfile;
    });
  }
});


const menu = ref();
const userMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
        { label: 'Profil', icon: 'person', command: () => router.push({ name: 'profile' }) }
    ];
    
    if (isAdmin.value) {
        items.push({ label: 'Administration', icon: 'settings', command: () => router.push({ name: 'admin-dashboard' }) });
    }
    items.push({ separator: true });
    items.push({ label: 'Déconnexion', icon: 'logout', command: () => authStore.logoutUser() });
    
    return items;
});

const toggleMenu = (event: Event) => menu.value.toggle(event);
</script>

<template>
  <header
    class="flex justify-between items-center p-4 bg-white border-b border-slate-100 sticky top-0 z-50"
  >
    <div
      class="flex items-center gap-3 cursor-pointer group"
      @click="router.push({ name: 'dashboard' })"
    >
      
      <img
        src="/img/logo.png"
        alt="Logo"
        class="h-10 w-auto object-contain transition-transform group-hover:scale-105"
      />
      

      <span
        class="font-brand text-2xl font-bold text-slate-800 group-hover:text-[var(--color-primary)] transition-colors"
      >
        Client tracker
      </span>
    </div>

    <div class="flex items-center gap-3">
      
      <div v-if="authStore.user" class="flex items-center gap-3">
        <div class="hidden sm:flex flex-col text-right mr-1">
          <span
            class="text-sm font-semibold text-slate-700 leading-tight font-body"
          >
            {{ userDisplayName }}
          </span>
          <span
            v-if="isAdmin"
            class="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider"
          >
            Admin
          </span>
        </div>

        <Avatar
          :image="authStore.user?.photoURL ?? undefined"
          :label="
            !authStore.user?.photoURL
              ? userDisplayName.charAt(0).toUpperCase()
              : undefined
          "
          shape="circle"
          class="cursor-pointer hover:shadow-md transition-shadow"
          style="background-color: var(--color-primary); color: #ffffff"
          @click="toggleMenu"
        />
        <Menu ref="menu" :model="userMenuItems" :popup="true">
          <template #itemicon="{ item }">
            <span class="material-symbols-outlined text-lg">{{ item.icon }}</span>
          </template>
        </Menu>
      </div>
      <Button
        v-else
        label="Connexion"
        size="small"
        @click="router.push('/login')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">login</span></template>
      </Button>
      
    </div>
  </header>
</template>
