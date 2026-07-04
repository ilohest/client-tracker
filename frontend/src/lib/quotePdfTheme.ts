import type { UserProfile } from '@client-tracker/contracts';

export const DEFAULT_QUOTE_PDF_THEME = {
  textColor: '#23262f',
  titleColor: '#23262f',
  accentColor: '#14161f',
  headingFont: 'Fraunces',
  headingFontVariant: '600',
  headingFontGoogleFamily: 'Fraunces:opsz,wght@9..144,600',
  bodyFont: 'Inter',
  bodyFontVariant: 'regular',
  bodyFontGoogleFamily: 'Inter:wght@400',
};

export const QUOTE_PDF_FONT_OPTIONS = [
  {
    label: 'Fraunces',
    value: 'Fraunces',
    googleFamily: 'Fraunces:opsz,wght@9..144,500;9..144,600',
    stack: "'Fraunces', Georgia, 'Times New Roman', serif",
  },
  {
    label: 'Inter',
    value: 'Inter',
    googleFamily: 'Inter:wght@400;500;600',
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    label: 'Lora',
    value: 'Lora',
    googleFamily: 'Lora:wght@400;500;600',
    stack: "'Lora', Georgia, 'Times New Roman', serif",
  },
  {
    label: 'Playfair Display',
    value: 'Playfair Display',
    googleFamily: 'Playfair Display:wght@500;600;700',
    stack: "'Playfair Display', Georgia, 'Times New Roman', serif",
  },
  {
    label: 'Montserrat',
    value: 'Montserrat',
    googleFamily: 'Montserrat:wght@400;500;600;700',
    stack: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    label: 'Manrope',
    value: 'Manrope',
    googleFamily: 'Manrope:wght@400;500;600;700',
    stack: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    label: 'Cormorant Garamond',
    value: 'Cormorant Garamond',
    googleFamily: 'Cormorant Garamond:wght@500;600;700',
    stack: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  },
];

const isHexColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

const getFontOption = (value: string) =>
  QUOTE_PDF_FONT_OPTIONS.find((option) => option.value === value);

const parseFontVariant = (variant: string): { weight: number; style: 'normal' | 'italic' } => {
  if (variant === 'regular') return { weight: 400, style: 'normal' };
  if (variant === 'italic') return { weight: 400, style: 'italic' };
  const style = variant.endsWith('italic') ? 'italic' : 'normal';
  const weight = Number.parseInt(variant.replace('italic', ''), 10);
  return { weight: Number.isFinite(weight) ? weight : 400, style };
};

const quoteFontFamily = (family: string, fallback: string): string =>
  `'${(family || fallback).replace(/'/g, "\\'")}'`;

const fallbackGoogleFamily = (font: string, defaultFamily: string): string =>
  (getFontOption(font)?.googleFamily || getFontOption(defaultFamily)?.googleFamily || '').replace(/ /g, '+');

export const normalizeQuotePdfTheme = (profile?: UserProfile | null) => ({
  textColor: isHexColor(profile?.quotePdfTextColor || '')
    ? profile?.quotePdfTextColor || DEFAULT_QUOTE_PDF_THEME.textColor
    : DEFAULT_QUOTE_PDF_THEME.textColor,
  titleColor: isHexColor(profile?.quotePdfTitleColor || '')
    ? profile?.quotePdfTitleColor || DEFAULT_QUOTE_PDF_THEME.titleColor
    : DEFAULT_QUOTE_PDF_THEME.titleColor,
  accentColor: isHexColor(profile?.quotePdfAccentColor || '')
    ? profile?.quotePdfAccentColor || DEFAULT_QUOTE_PDF_THEME.accentColor
    : DEFAULT_QUOTE_PDF_THEME.accentColor,
  headingFont: profile?.quotePdfHeadingFont || DEFAULT_QUOTE_PDF_THEME.headingFont,
  headingFontVariant: profile?.quotePdfHeadingFontVariant || DEFAULT_QUOTE_PDF_THEME.headingFontVariant,
  headingFontGoogleFamily:
    profile?.quotePdfHeadingFontGoogleFamily ||
    fallbackGoogleFamily(profile?.quotePdfHeadingFont || '', DEFAULT_QUOTE_PDF_THEME.headingFont),
  bodyFont: profile?.quotePdfBodyFont || DEFAULT_QUOTE_PDF_THEME.bodyFont,
  bodyFontVariant: profile?.quotePdfBodyFontVariant || DEFAULT_QUOTE_PDF_THEME.bodyFontVariant,
  bodyFontGoogleFamily:
    profile?.quotePdfBodyFontGoogleFamily ||
    fallbackGoogleFamily(profile?.quotePdfBodyFont || '', DEFAULT_QUOTE_PDF_THEME.bodyFont),
});

export const getQuotePdfFontStack = (value: string): string =>
  getFontOption(value)?.stack ||
  `${quoteFontFamily(value, DEFAULT_QUOTE_PDF_THEME.bodyFont)}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

export const getQuotePdfFontVariantStyle = parseFontVariant;

export const getQuotePdfGoogleFontsHref = (headingFamily: string, bodyFamily: string): string => {
  const families = [headingFamily, bodyFamily].filter(Boolean);
  const uniqueFamilies = [...new Set(families)];
  const familyQuery = uniqueFamilies
    .map((family) => `family=${family.replace(/ /g, '+')}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
};

export const mixHexWithWhite = (hex: string, whiteRatio: number): string => {
  const normalized = isHexColor(hex) ? hex : DEFAULT_QUOTE_PDF_THEME.accentColor;
  const ratio = Math.min(1, Math.max(0, whiteRatio));
  const value = normalized.slice(1);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel * (1 - ratio) + 255 * ratio);
  return `#${[mix(red), mix(green), mix(blue)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};
