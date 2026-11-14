import type { SubStatus } from '@/types';

export const colors = {
  primary: '#6C5CE7',
  primaryDark: '#5546C9',
  primarySoft: '#EFEDFD',
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#1B1B2F',
  muted: '#7A7F94',
  border: '#E6E8F0',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  success: '#1FA971',
  successSoft: '#E3F6EE',
  warning: '#E08A00',
  warningSoft: '#FFF3DC',
  info: '#3E63DD',
  infoSoft: '#E8EDFD',
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };

export const STATUS_META: Record<SubStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: colors.success, bg: colors.successSoft },
  trial: { label: 'Free trial', color: colors.info, bg: colors.infoSoft },
  paused: { label: 'Paused', color: colors.warning, bg: colors.warningSoft },
  cancelled: { label: 'Cancelled', color: colors.danger, bg: colors.dangerSoft },
  expired: { label: 'Expired', color: colors.muted, bg: '#ECEDF3' },
};

export const shadow = {
  shadowColor: '#1B1B2F',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};
