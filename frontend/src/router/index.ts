// frontend/src/router/index.ts
// frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '../stores/authStore';


const router = createRouter({
  history: createWebHistory(),
  routes: [
    // --- 1. APP LAYOUT (Routes protégées) ---
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // --- ESPACE UTILISATEUR ---
        {
           path: '',
           name: 'dashboard',
           component: () => import('../views/Dashboard.vue'),
           meta: { title: 'Tableau de bord' }
        },
        {
           path: 'profile',
           name: 'profile',
           component: () => import('../views/Profile.vue'),
           meta: { title: 'Infos profil' }
        },
        {
           path: 'security',
           name: 'security',
           component: () => import('../views/SecuritySettings.vue'),
           meta: { title: 'Sécurité' }
        },
        {
           path: 'clients',
           name: 'clients',
           component: () => import('../views/ClientsWorkspace.vue'),
           meta: { title: 'Clients' }
        },
        {
           path: 'quotes',
           name: 'quotes',
           component: () => import('../views/QuotesWorkspace.vue'),
           meta: { title: 'Devis' }
        },
        {
           path: 'projects',
           name: 'projects',
           component: () => import('../views/ProjectsWorkspace.vue'),
           meta: { title: 'Projets' }
        },
        {
           path: 'timesheets',
           name: 'timesheets',
           component: () => import('../views/TimesheetsWorkspace.vue'),
           meta: { title: 'Timesheets' }
        },
        {
           path: 'quote-templates',
           name: 'quote-templates',
           component: () => import('../views/QuoteTemplatesWorkspace.vue'),
           meta: { title: 'Templates' }
        },
        {
           path: 'quote-design',
           name: 'quote-design',
           component: () => import('../views/QuoteDesignSettings.vue'),
           meta: { title: 'Design des devis' }
        },
        
        // --- RESSOURCES & OUTILS ---
        {
          path: '/documentation',
          name: 'documentation',
          component: () => import('../views/Documentation.vue'),
          meta: { title: 'Documentation' }
        },

        // --- ESPACE ADMINISTRATION ---
        {
           path: 'admin',
           name: 'admin-dashboard',
           component: () => import('../views/AdminDashboard.vue'),
           meta: { requiresAdmin: true, title: 'Admin' } 
        },

        
        {
           path: 'admin/users',
           name: 'admin-users',
           component: () => import('../views/AdminUsers.vue'),
           meta: { requiresAdmin: true, title: 'Utilisateurs' }
        },
        

        
      ]
    },
    
    // --- 2. AUTHENTIFICATION (Routes Publiques) ---
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/Login.vue'),
      meta: { requiresGuest: true, title: 'Connexion' }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/auth/Register.vue'),
      meta: { requiresGuest: true, title: 'Inscription' }
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPassword.vue'),
      meta: { requiresGuest: true, title: 'Récupération' }
    },
    {
      path: '/auth/action',
      name: 'auth-action',
      component: () => import('../views/auth/AuthAction.vue'),
      meta: { title: 'Action de sécurité' }
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('../views/auth/VerifyEmail.vue'),
      meta: { requiresAuth: true, title: 'Vérification email' }
    },
    

    // --- 3. 404 CATCH ALL ---
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFound.vue'),
      meta: { title: 'Page introuvable' }
    }
  ]
});


// --- NAVIGATION GUARDS (SÉCURITÉ V2) ---
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // 1. Titre de page dynamique
  const title = to.meta.title as string;
  if (title) {
    document.title = `${title} | Devisio`;
  } else {
    document.title = 'Devisio';
  }

  // 2. Initialisation Auth (Fix Refresh)
  if (!authStore.authInitialized) {
    await authStore.initAuth();
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin);
  const requiresGuest = to.matched.some((record) => record.meta.requiresGuest); // Nouveau
  
  const currentUser = authStore.user;
  const isAdmin = authStore.isAdmin;

  // 3. Logique de Redirection
  if (requiresAuth && !currentUser) {
    // Cas : Veut accéder au dashboard sans être connecté
    next({ name: 'login' });
  }
  //  Vérification Email
  else if (requiresAuth && currentUser && !currentUser.emailVerified && to.name !== 'verify-email') {
    next({ name: 'verify-email' });
  }
  else if (requiresGuest && currentUser) {
    // Cas : Est connecté mais essaie d'aller sur /login ou /register
    next({ name: 'dashboard' });
  }
  else if (requiresAdmin && !isAdmin) {
    // Cas : Est connecté mais veut accéder à l'admin sans droits
    // On pourrait rediriger vers une page 403, ici on renvoie au dashboard
    next({ name: 'dashboard' }); 
  } 
  else {
    // Tout est bon
    next();
  }
});


export default router;
