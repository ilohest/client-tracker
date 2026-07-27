<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { useToast } from "primevue/usetoast";
  import { useAuthStore } from "@/stores/authStore";
  import { USER_COLORS } from "@client-tracker/contracts";

  // Utilitaire de date centralisé
  import { formatDateLong } from "@/utils/date";

  // Components PrimeVue
  import DataTable from "primevue/datatable";
  import Column from "primevue/column";
  import Tag from "primevue/tag";
  import Button from "primevue/button";
  import InputText from "primevue/inputtext";
  import IconField from "primevue/iconfield";
  import InputIcon from "primevue/inputicon";
  import Dialog from "primevue/dialog";
  import Password from "primevue/password";
  import Avatar from "primevue/avatar";
  import SelectButton from "primevue/selectbutton";

  
  import { collection, getDocs } from 'firebase/firestore';
  import { db } from '@/services/firebase';
  

  import type { AppUser } from "@client-tracker/contracts";

  const toast = useToast();
  const authStore = useAuthStore();

  const loading = ref(false);
  const users = ref<AppUser[]>([]);
  const globalFilter = ref('');

  // --- DIALOGS STATES ---
  const userDialog = ref(false);
  const isEditMode = ref(false);
  const submitting = ref(false);

  // Formulaire User
  const userForm = ref({
    uid: '',
    email: '',
    password: '',
    displayName: '',
role: 'user' as 'user' | 'admin',
    color: USER_COLORS[0]
  });

  const roles = ref(['user', 'admin']);

  // --- COMPUTES ---
  const filteredUsers = computed(() => {
    if (!globalFilter.value) return users.value;
    const term = globalFilter.value.toLowerCase();
    return users.value.filter(u =>
      (u.email || '').toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term)) ||
      u.uid.includes(term)
    );
  });

  // --- DATA FETCHING ---
  const fetchUsers = async () => {
    loading.value = true;
    try {
        
        const snapshot = await getDocs(collection(db, 'users'));
        users.value = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as AppUser[];
        
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les utilisateurs' });
    } finally {
        loading.value = false;
    }
  };

  // --- ACTIONS ---

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    toast.add({ severity: 'info', summary: 'Copié', detail: 'UID copié dans le presse-papier', life: 2000 });
  };

  // CRUD
  const openCreate = () => {
    isEditMode.value = false;
    userForm.value = { uid: '', email: '', password: '', displayName: '', role: 'user', color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)] };
    userDialog.value = true;
  };

 const openEdit = (user: AppUser) => {
    isEditMode.value = true;
    userForm.value = {
        uid: user.uid,
email: user.email || '',
        password: '',
        displayName: user.displayName || '',
        role: (user as any).role || 'user',
        color: (user as any).color || USER_COLORS[0]
    };
    userDialog.value = true;
};

  const saveUser = async () => {
    submitting.value = true;
    try {
        
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: 'Une erreur est survenue' });
    } finally {
        submitting.value = false;
    }
  };

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : 'U';

  onMounted(() => fetchUsers());
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
    >
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">manage_accounts</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Utilisateurs</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            Gérez votre communauté ({{ users.length }}).
          </p>
        </div>
      </div>

      <div
        class="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center"
      >
        <IconField iconPosition="left" class="w-full sm:w-auto">
          <InputIcon><span class="material-symbols-outlined text-lg">search</span></InputIcon>
          <InputText
            v-model="globalFilter"
            placeholder="Rechercher..."
            class="w-full sm:w-64"
          />
        </IconField>

      </div>
    </div>

    <div
      class="card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <DataTable
        :value="filteredUsers"
        :loading="loading"
        paginator
        :rows="10"
        responsiveLayout="scroll"
      >
        <template #empty>
          <div class="text-center p-8 text-gray-500">
            Aucun utilisateur trouvé.
          </div>
        </template>

        <Column header="Utilisateur" sortable field="displayName">
          <template #body="{ data }">
            <div
              class="flex items-center gap-3 group cursor-pointer"
              @click="copyUid(data.uid)"
              title="Copier l'UID"
            >
              <Avatar
                :label="getInitials(data.displayName || data.email)"
                shape="circle"
                :style="{
                  backgroundColor: data.color || '#6366f1',
                  color: '#fff',
                }"
                class="flex-shrink-0"
              />
              <div class="flex flex-col">
                <span class="font-bold text-sm text-gray-800 leading-tight">
                  {{ data.displayName || "Sans pseudo" }}
                </span>
                <span class="text-xs text-gray-500">
                  {{ data.email }}
                </span>
                <span
                  class="text-[9px] font-mono text-gray-400 select-all leading-none mt-1 hover:text-primary transition-colors"
                >
                  {{ data.uid }}
                </span>
              </div>
            </div>
          </template>
        </Column>

        <Column field="role" header="Rôle" sortable>
          <template #body="{ data }">
            <Tag
              :value="(data.role || 'user').toUpperCase()"
              :severity="data.role === 'admin' ? 'danger' : 'info'"
              rounded
              class="text-[10px]"
            />
          </template>
        </Column>

        <Column field="lastSignInTime" header="Dernière connexion" sortable>
          <template #body="{ data }">
            <span class="text-sm text-gray-600">
              {{ formatDateLong(data.lastSignInTime) }}
            </span>
          </template>
        </Column>

        <Column
          field="creationTime"
          header="Inscrit le"
          class="hidden md:table-cell"
          sortable
        >
          <template #body="{ data }">
            <span class="text-sm text-gray-500">
              {{ formatDateLong(data.creationTime) }}
            </span>
          </template>
        </Column>

        <Column header="" alignFrozen="right" style="width: 50px">
          <template #body="{ data }">
            <Button
              text
              rounded
              severity="secondary"
              aria-label="Modifier"
              title="Modifier"
              @click="openEdit(data)"
            >
              <template #icon><span class="material-symbols-outlined text-lg">edit</span></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="userDialog"
      modal
      :header="isEditMode ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'"
      class="w-full md:w-[500px]"
    >
      <div class="flex flex-col gap-4 py-2">
        <div class="flex justify-center mb-2">
          <Avatar
            :label="getInitials(userForm.displayName || userForm.email)"
            size="xlarge"
            shape="circle"
            :style="{ backgroundColor: userForm.color, color: '#fff' }"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-bold">Email</label>
          <InputText v-model="userForm.email" :disabled="isEditMode" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-bold">Pseudo</label>
          <InputText v-model="userForm.displayName" />
        </div>

        <div v-if="!isEditMode" class="flex flex-col gap-1">
          <label class="text-sm font-bold">Mot de passe</label>
          <Password v-model="userForm.password" :feedback="false" toggleMask />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-bold">Rôle</label>
          <SelectButton v-model="userForm.role" :options="roles" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-bold">Couleur de profil</label>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="c in USER_COLORS"
              :key="c"
              class="w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 border-2"
              :class="
                userForm.color === c ? 'border-gray-800' : 'border-transparent'
              "
              :style="{ backgroundColor: c }"
              @click="userForm.color = c"
            ></div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" text @click="userDialog = false" />
        <Button
          v-if="isEditMode"
          aria-label="Enregistrer"
          title="Enregistrer"
          @click="saveUser"
          :loading="submitting"
        >
          <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        </Button>
        <Button
          v-else
          label="Créer"
          @click="saveUser"
          :loading="submitting"
        />
      </template>
    </Dialog>
  </div>
</template>
