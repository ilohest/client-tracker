import type { Client, UserProfile } from '@client-tracker/contracts';

const compact = (values: Array<string | undefined>): string[] =>
  values.map((value) => value?.trim() || '').filter(Boolean);

export const formatClientAddress = (
  client: Pick<Client, 'street' | 'streetNumber' | 'postalCode' | 'city' | 'country' | 'address'>,
): string => {
  const firstLine = compact([client.street, client.streetNumber]).join(' ');
  const secondLine = compact([client.postalCode, client.city]).join(' ');
  const thirdLine = compact([client.country]).join(' ');
  const formatted = compact([firstLine, secondLine, thirdLine]).join('\n');
  return formatted || client.address || '';
};

export const formatBillingAddress = (
  profile: Pick<
    UserProfile,
    'billingStreet' | 'billingStreetNumber' | 'billingPostalCode' | 'billingCity' | 'billingCountry' | 'address'
  >,
): string => {
  const firstLine = compact([profile.billingStreet, profile.billingStreetNumber]).join(' ');
  const secondLine = compact([profile.billingPostalCode, profile.billingCity]).join(' ');
  const thirdLine = compact([profile.billingCountry]).join(' ');
  const formatted = compact([firstLine, secondLine, thirdLine]).join('\n');
  return formatted || profile.address || '';
};

export const formatClientFullName = (
  client: Pick<Client, 'firstName' | 'lastName' | 'name'>,
): string => {
  const formatted = compact([client.firstName, client.lastName]).join(' ');
  return formatted || client.name || '';
};
