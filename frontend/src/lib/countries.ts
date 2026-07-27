const countryCodes = [
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR',
  'IO','BN','BG','BF','BI','CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC',
  'CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO',
  'EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF',
  'GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY',
  'HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM',
  'JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY',
  'LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX',
  'FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI',
  'NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH',
  'PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC',
  'WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS',
  'SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK',
  'TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU',
  'VE','VN','VG','VI','WF','EH','YE','ZM','ZW',
] as const;

const displayNames = new Intl.DisplayNames(['fr-FR'], { type: 'region' });

export type CountryOption = { label: string; value: string; flag: string };

export const euroCountryCodes = new Set([
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA',
 ]);

export const getCountryFlag = (countryCode: string): string => {
  if (!/^[A-Z]{2}$/.test(countryCode)) return '🌍';
  return String.fromCodePoint(
    ...countryCode.split('').map((char) => 127397 + char.charCodeAt(0)),
  );
};

export const countryOptions: CountryOption[] = [...countryCodes]
  .sort((a, b) => (displayNames.of(a) || a).localeCompare(displayNames.of(b) || b, 'fr'))
  .map((code) => ({
    value: code,
    label: displayNames.of(code) || code,
    flag: getCountryFlag(code),
  }));

export const getCountryLabel = (countryCode: string): string =>
  countryOptions.find((country) => country.value === countryCode)?.label ||
  countryCode ||
  'Non renseigné';

export const isEuroCountry = (countryCode: string): boolean =>
  euroCountryCodes.has(countryCode);

const diacriticsPattern = new RegExp('[\\u0300-\\u036f]', 'g');

const normalizeCountryText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(diacriticsPattern, '');

const countryLabelLookup = new Set(
  countryOptions.map((country) => normalizeCountryText(country.label)),
);

/** Vrai si la ligne est un pays, qu'il soit écrit en code (« BE ») ou en toutes lettres (« Belgique »). */
export const isCountryLine = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[A-Z]{2}$/i.test(trimmed)) return true;
  return countryLabelLookup.has(normalizeCountryText(trimmed));
};
