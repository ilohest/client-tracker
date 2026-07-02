<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import Drawer from 'primevue/drawer';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// --- ETAT COMMUN ---
const mobileMenuOpen = ref(false);
const userMenu = ref();

const toggleUserMenu = (event: any) => {
    userMenu.value.toggle(event);
};

// --- NAVIGATION ---
// 1. Liens Principaux (Accessibles à tous ou connectés)
const mainLinks = computed(() => [
    { label: 'Tableau de bord', icon: 'home', to: '/' },
    { label: 'Devis', icon: 'receipt_long', to: '/quotes' },
    { label: 'Clients', icon: 'groups', to: '/clients' },
    { label: 'Templates devis', icon: 'library_books', to: '/quote-templates' },
    { label: 'Documentation', icon: 'menu_book', to: '/documentation' },
]);

// 2. Liens Admin (Sous-menu)
const adminLinks = computed(() => {
    if (!authStore.isAdmin) return [];

    const links = [
        { label: 'Vue d\'ensemble', icon: 'dashboard', to: '/admin' } // Le Hub
    ];

    // On peut choisir de mettre les sous-liens ici pour un accès rapide en Sidebar
    // OU de laisser l'utilisateur passer par le Dashboard Admin.
    // Pour une UX "Pro", c'est bien d'avoir l'accès direct en sidebar :

    
    links.push({ label: 'Utilisateurs', icon: 'group', to: '/admin/users' });
    

    

    return links;
});

const userMenuItems = [
    { label: 'Mon Profil', icon: 'person', command: () => router.push('/profile') },
    { separator: true },
    { label: 'Déconnexion', icon: 'logout', class: 'text-red-500', command: () => authStore.logoutUser() }
];

const userInitials = computed(() =>
    authStore.user?.displayName
    ? authStore.user.displayName.substring(0, 2).toUpperCase()
    : (authStore.user?.email?.substring(0, 2).toUpperCase() || 'U')
);
</script>

<template>
  <div class="min-h-screen bg-surface-light flex flex-col">
    
    <aside
      class="hidden lg:flex flex-col w-64 bg-surface-card border-r border-surface-dark/5 fixed h-full z-20"
    >
      <div
        class="h-16 flex items-center px-6 border-b border-surface-dark/5 shrink-0"
      >
        
        <img
          src="/img/logo.png"
          alt="Logo"
          class="h-8 w-auto mr-2"
        />
        
        <span class="font-brand font-bold text-xl text-surface-dark"
          >Devisio</span
        >
      </div>

      <nav
        class="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1 custom-scrollbar"
      >
        <router-link
          v-for="link in mainLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent"
          :class="
            route.path === link.to
              ? 'bg-primary/10 text-primary border-primary/10'
              : 'text-surface-dark/70 hover:bg-surface-dark/5 hover:text-surface-dark'
          "
        >
          <span
            class="material-symbols-outlined"
            :class="[
              route.path === link.to ? 'text-primary' : 'text-surface-dark/50',
            ]"
          >{{ link.icon }}</span>
          {{ link.label }}
        </router-link>

        <div
          v-if="authStore.isAdmin && adminLinks.length > 0"
          class="mt-6 mb-2 px-3"
        >
          <span
            class="text-[10px] uppercase font-bold text-surface-dark/40 tracking-wider"
            >Administration</span
          >
        </div>

        <router-link
          v-if="authStore.isAdmin"
          v-for="link in adminLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent"
          :class="
            route.path === link.to
              ? 'bg-surface-dark/10 text-surface-dark border-surface-dark/10'
              : 'text-surface-dark/60 hover:bg-surface-dark/5 hover:text-surface-dark'
          "
        >
          <span class="material-symbols-outlined text-surface-dark/50">{{ link.icon }}</span>
          {{ link.label }}
        </router-link>
      </nav>

      <div class="p-4 border-t border-surface-dark/5 shrink-0">
        <div
          class="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-dark/5 cursor-pointer transition-colors"
          @click="toggleUserMenu"
          aria-haspopup="true"
          aria-controls="user_menu"
        >
          <Avatar
            :label="userInitials"
            shape="circle"
            class="bg-primary text-white shadow-sm font-bold shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-surface-dark truncate">
              {{ authStore.user?.displayName || "Utilisateur" }}
            </p>
          </div>
          <span class="material-symbols-outlined text-xs text-surface-dark/30">more_vert</span>
        </div>
      </div>
    </aside>

    <main class="flex-1 lg:pl-64 flex flex-col min-h-screen pt-16 lg:pt-0">
      <div
        class="lg:hidden fixed top-0 left-0 right-0 h-16 bg-surface-card border-b border-surface-dark/5 z-30 flex items-center justify-between px-4"
      >
        <div class="flex items-center gap-3">
          <Button text @click="mobileMenuOpen = true">
            <template #icon><span class="material-symbols-outlined text-lg">menu</span></template>
          </Button>
          <span class="font-brand font-bold text-lg text-surface-dark"
            >Devisio</span
          >
        </div>
        <Avatar
          :label="userInitials"
          shape="circle"
          @click="toggleUserMenu"
          class="bg-primary text-white"
        />
      </div>

      <div class="p-4 sm:p-8 flex-1">
        <router-view />
      </div>
    </main>

    

    <Drawer v-model:visible="mobileMenuOpen">
      <template #header>
        <div class="flex items-center gap-2">
          
          <img
            src="/img/logo.png"
            alt="Logo"
            class="h-6 w-auto"
          />
          
          <span class="font-brand font-bold text-xl">Devisio</span>
        </div>
      </template>
      <nav class="flex flex-col gap-2 mt-4">
        <router-link
          v-for="link in mainLinks"
          :key="link.to"
          :to="link.to"
          @click="mobileMenuOpen = false"
          class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors"
          :class="
            route.path === link.to
              ? 'bg-primary/10 text-primary'
              : 'text-surface-dark/70 hover:bg-surface-dark/5'
          "
        >
          <span class="material-symbols-outlined text-lg">{{ link.icon }}</span>
          {{ link.label }}
        </router-link>

        <div
          v-if="authStore.isAdmin"
          class="my-2 border-t border-surface-dark/5"
        ></div>
        <div
          v-if="authStore.isAdmin"
          class="px-3 text-[10px] font-bold text-surface-dark/40 uppercase"
        >
          Admin
        </div>

        <router-link
          v-if="authStore.isAdmin"
          v-for="link in adminLinks"
          :key="link.to"
          :to="link.to"
          @click="mobileMenuOpen = false"
          class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-surface-dark/70 hover:bg-surface-dark/5"
        >
          <span class="material-symbols-outlined text-lg">{{ link.icon }}</span>
          {{ link.label }}
        </router-link>
      </nav>
    </Drawer>

    <Menu ref="userMenu" id="user_menu" :model="userMenuItems" :popup="true">
      <template #itemicon="{ item }">
        <span class="material-symbols-outlined text-lg">{{ item.icon }}</span>
      </template>
    </Menu>
  </div>
</template>

<style scoped>
/* Petit utilitaire pour la scrollbar custom si besoin */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
