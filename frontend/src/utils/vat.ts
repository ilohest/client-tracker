import type { Client, UserProfile, VatRate } from '@client-tracker/contracts';
import { euCountryCodes } from '@/lib/clientPresets';

export const computeVatRateForClient = (
  client: Pick<Client, 'country' | 'isVatRegistered' | 'vatNumber'> | null,
  profile: Pick<UserProfile, 'billingCountry'> | null,
): VatRate => {
  const sellerCountry = profile?.billingCountry || '';
  const clientCountry = client?.country || '';

  if (!client || !sellerCountry || !clientCountry) return 21;
  if (clientCountry === 'OTHER') return 21;
  if (clientCountry === sellerCountry) return 21;
  if (!euCountryCodes.has(clientCountry)) return 0;

  if (euCountryCodes.has(sellerCountry) && client.isVatRegistered && Boolean(client.vatNumber?.trim())) {
    return 0;
  }

  return 21;
};

export const getVatExplanation = (
  client: Pick<Client, 'country' | 'isVatRegistered' | 'vatNumber' | 'name'> | null,
  profile: Pick<UserProfile, 'billingCountry'> | null,
): string => {
  if (!client) return 'Sélectionne un client pour appliquer automatiquement la TVA.';
  const sellerCountry = profile?.billingCountry || '';
  const clientCountry = client.country || '';

  if (!sellerCountry || !clientCountry) {
    return 'Renseigne ton pays de facturation et le pays du client pour automatiser la TVA.';
  }

  if (clientCountry === sellerCountry) {
    return `Client domestique: TVA locale appliquée.`;
  }

  if (!euCountryCodes.has(clientCountry)) {
    return `Client hors UE: TVA non facturée.`;
  }

  if (euCountryCodes.has(sellerCountry) && client.isVatRegistered && Boolean(client.vatNumber?.trim())) {
    return `Client assujetti dans un autre pays UE: prestation intracommunautaire sans TVA.`;
  }

  return `Client UE sans numéro de TVA valide: TVA locale appliquée.`;
};
