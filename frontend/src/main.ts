// frontend/src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// --- UI FRAMEWORK (PrimeVue 4) ---
import PrimeVue from 'primevue/config';
import Nora from '@primeuix/themes/nora'; 
import { definePreset, palette } from '@primeuix/themes';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';

// --- STYLES ---
import './style.css'; 

// --- SERVICES & STORES ---

import { auth } from './services/firebase'; 
import { useAuthStore } from './stores/authStore';


const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(ToastService);
app.use(ConfirmationService);
app.directive('tooltip', Tooltip);

// --- THEME CONFIGURATION ---
const ForgePreset = definePreset(Nora, {
    semantic: {
        // CORRECTION : Injection dynamique de la couleur primaire
        primary: palette('#4C5EF7')
    }
});

app.use(PrimeVue, {
    theme: {
        preset: ForgePreset,
        options: {
            cssLayer: {
                name: "primevue",
                order: "base, primevue, components, utilities",
            },
            darkModeSelector: false,
        },
    },
    ripple: true,
});

async function startApp() {
    
    const authStore = useAuthStore();
    try {
        await authStore.initAuth();
    } catch (e) {
        console.error("❌ Échec de l'initialisation de la session:", e);
    }
    

    app.use(router);
    app.mount('#app');
}

startApp();