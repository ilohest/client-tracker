<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { Client, ClientInput } from '@client-tracker/contracts';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Select from 'primevue/select';
import CountrySelect from '@/components/clients/CountrySelect.vue';
import { createClientProject, createOnboardingTasks, languageOptions } from '@/lib/clientPresets';
import { formatClientAddress } from '@/utils/address';

const props = defineProps<{
  visible: boolean;
  client: Client | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [payload: ClientInput, id: string | null];
}>();

const form = reactive<ClientInput>({
  name: '',
  firstName: '',
  lastName: '',
  companyName: '',
  contactEmail: '',
  phone: '',
  address: '',
  street: '',
  streetNumber: '',
  postalCode: '',
  city: '',
  website: '',
  country: 'BE',
  isVatRegistered: false,
  vatNumber: '',
  platform: 'other',
  language: 'fr',
  stage: 'lead',
  notes: '',
  documents: [],
  projects: [createClientProject()],
  onboardingTasks: createOnboardingTasks(),
});

const dialogTitle = computed(() => (props.client ? 'Modifier le client' : 'Nouveau client'));

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;

    if (props.client) {
      Object.assign(form, {
        name: props.client.name,
        firstName: props.client.firstName || '',
        lastName: props.client.lastName || '',
        companyName: props.client.companyName || '',
        contactEmail: props.client.contactEmail || '',
        phone: props.client.phone || '',
        address: props.client.address || '',
        street: props.client.street || '',
        streetNumber: props.client.streetNumber || '',
        postalCode: props.client.postalCode || '',
        city: props.client.city || '',
        website: props.client.website || '',
        country: props.client.country || 'BE',
        isVatRegistered: props.client.isVatRegistered || false,
        vatNumber: props.client.vatNumber || '',
        platform: props.client.platform || 'other',
        language: props.client.language,
        stage: props.client.stage || 'lead',
        notes: props.client.notes || '',
        documents: props.client.documents || [],
        projects: props.client.projects?.length ? props.client.projects.map((project) => ({ ...project, onboardingTasks: project.onboardingTasks.map((task) => ({ ...task })) })) : [createClientProject()],
        onboardingTasks: props.client.onboardingTasks.map((task) => ({ ...task })),
      });
      return;
    }

    Object.assign(form, {
      name: '',
      firstName: '',
      lastName: '',
      companyName: '',
      contactEmail: '',
      phone: '',
      address: '',
      street: '',
      streetNumber: '',
      postalCode: '',
      city: '',
      website: '',
      country: 'BE',
      isVatRegistered: false,
      vatNumber: '',
      platform: 'other',
      language: 'fr',
      stage: 'lead',
      notes: '',
      documents: [],
      projects: [createClientProject()],
      onboardingTasks: createOnboardingTasks(),
    });
  },
  { immediate: true },
);

const handleSave = () => {
  emit(
    'save',
    {
      ...form,
      name: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' '),
      address: formatClientAddress(form),
      projects: form.projects.length ? form.projects : [createClientProject()],
      onboardingTasks: [...form.onboardingTasks],
    },
    props.client?.id || null,
  );
};
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="dialogTitle"
    class="!w-[92vw] !max-w-3xl"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Prénom</span>
        <InputText v-model="form.firstName" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Nom</span>
        <InputText v-model="form.lastName" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Société</span>
        <InputText v-model="form.companyName" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Email</span>
        <InputText v-model="form.contactEmail" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Téléphone</span>
        <InputText v-model="form.phone" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Site</span>
        <InputText v-model="form.website" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Langue</span>
        <Select v-model="form.language" :options="languageOptions" option-label="label" option-value="value" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">N° TVA</span>
        <InputText v-model="form.vatNumber" :disabled="!form.isVatRegistered" placeholder="BE0123.456.789" />
      </label>
      <label class="flex items-center gap-3 md:col-span-2">
        <Checkbox v-model="form.isVatRegistered" binary input-id="client-vat-registered" />
        <span class="text-sm font-semibold text-surface-dark">Client assujetti à la TVA</span>
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Rue</span>
        <InputText v-model="form.street" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">N°</span>
        <InputText v-model="form.streetNumber" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Code postal</span>
        <InputText v-model="form.postalCode" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Ville</span>
        <InputText v-model="form.city" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Pays</span>
        <CountrySelect v-model="form.country" />
      </label>
      <label class="flex flex-col gap-2 md:col-span-2">
        <span class="text-sm font-semibold text-surface-dark">Notes internes</span>
        <Textarea v-model="form.notes" rows="4" />
      </label>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button text severity="secondary" @click="emit('update:visible', false)">Annuler</Button>
        <Button @click="handleSave">Enregistrer</Button>
      </div>
    </template>
  </Dialog>
</template>
