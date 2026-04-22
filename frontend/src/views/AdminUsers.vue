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
  import FileUpload from "primevue/fileupload";
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
  const importDialog = ref(false);
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

  // EXPORT JSON
  const exportUsers = () => {
    const dataStr = JSON.stringify(users.value, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    // Format date simple YYYY-MM-DD
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `users_export_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // IMPORT JSON
  const onImport = async (event: any) => {
    const file = event.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target?.result as string);
            if (!Array.isArray(importedData)) throw new Error("Format invalide (Array attendu)");

            let successCount = 0;
            for (const u of importedData) {
                 
            }

            toast.add({ severity: 'success', summary: 'Import terminé', detail: `${successCount} utilisateurs importés.` });
            importDialog.value = false;
            fetchUsers();

        } catch (err) {
            toast.add({ severity: 'error', summary: 'Erreur Import', detail: 'Fichier JSON invalide' });
        }
    };
    reader.readAsText(file);
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
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Utilisateurs</h1>
        <p class="text-slate-500 text-sm">
          Gérez votre communauté ({{ users.length }}).
        </p>
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

        <div class="flex gap-2">
          <Button
            label="Export"
            outlined
            severity="secondary"
            @click="exportUsers"
          >
            <template #icon><span class="material-symbols-outlined text-lg">download</span></template>
          </Button>
          <Button
            label="Import"
            outlined
            severity="secondary"
            @click="importDialog = true"
          >
            <template #icon><span class="material-symbols-outlined text-lg">upload</span></template>
          </Button>
          <Button label="Nouveau" @click="openCreate">
            <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
          </Button>
          <Button
            text
            rounded
            severity="secondary"
            @click="fetchUsers"
            :loading="loading"
          >
            <template #icon><span class="material-symbols-outlined text-lg">refresh</span></template>
          </Button>
        </div>
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
          :label="isEditMode ? 'Enregistrer' : 'Créer'"
          @click="saveUser"
          :loading="submitting"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="importDialog"
      modal
      header="Importer des utilisateurs"
      class="w-full md:w-[400px]"
    >
      <div class="flex flex-col gap-4 text-center">
        <p class="text-sm text-gray-500">
          Sélectionnez un fichier JSON contenant une liste d'utilisateurs.
        </p>
        <FileUpload
          mode="basic"
          name="demo[]"
          accept=".json"
          :maxFileSize="1000000"
          customUpload
          @select="onImport"
          auto
          chooseLabel="Choisir un fichier JSON"
        />
      </div>
    </Dialog>
  </div>
</template>
