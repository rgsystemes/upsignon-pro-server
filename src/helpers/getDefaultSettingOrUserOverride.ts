export type BANK_SETTINGS = {
  DISABLE_OFFLINE_MODE_DEFAULT_DESKTOP?: boolean | null;
  DISABLE_OFFLINE_MODE_DEFAULT_MOBILE?: boolean | null;
  ALLOWED_TO_EXPORT?: boolean | null;
  ALLOWED_WINDOWS?: boolean | null;
  ALLOWED_IOS?: boolean | null;
  ALLOWED_ANDROID?: boolean | null;
  ALLOWED_MACOS?: boolean | null;
  ALLOWED_LINUX?: boolean | null;
  DEFAULT_AUTOLOCK_DELAY_DESKTOP?: number;
  MAX_AUTOLOCK_DELAY_DESKTOP?: number;
  DEFAULT_AUTOLOCK_DELAY_MOBILE?: number;
  MAX_AUTOLOCK_DELAY_MOBILE?: number;
} | null;

type USER_OVERRIDE = {
  allowed_to_export?: boolean | null;
  allowed_offline_desktop?: boolean | null;
  allowed_offline_mobile?: boolean | null;
} | null;

export type USER_SETTINGS_OVERRIDE = {
  ALLOWED_WINDOWS?: boolean | null;
  ALLOWED_IOS?: boolean | null;
  ALLOWED_ANDROID?: boolean | null;
  ALLOWED_MACOS?: boolean | null;
  ALLOWED_LINUX?: boolean | null;
};

type RESULTING_USER_SETTINGS = {
  allowed_to_export: boolean;
  allowed_offline: boolean;
  defaultAutolockDelay: number | null;
  maxAutolockDelay: number | null;
};

export const getDefaultSettingOrUserOverride = (
  defaultSettings: BANK_SETTINGS,
  userOverride: USER_OVERRIDE,
  osFamily: string,
): RESULTING_USER_SETTINGS => {
  const allowed_to_export =
    userOverride?.allowed_to_export == null
      ? defaultSettings?.ALLOWED_TO_EXPORT || false
      : userOverride?.allowed_to_export;

  const isDesktop =
    osFamily.toLowerCase() === 'windows' ||
    osFamily.toLowerCase() === 'macos' ||
    osFamily.toLowerCase() === 'linux' ||
    // the web app uses the desktop defaults
    osFamily.toLowerCase() === 'web' ||
    // for backwards compat
    osFamily.indexOf('Windows') === 0 ||
    osFamily.indexOf('Mac') === 0 ||
    osFamily.indexOf('Linux') === 0;

  const allowed_offline_desktop =
    userOverride?.allowed_offline_desktop == null
      ? !defaultSettings?.DISABLE_OFFLINE_MODE_DEFAULT_DESKTOP
      : userOverride?.allowed_offline_desktop;
  const allowed_offline_mobile =
    userOverride?.allowed_offline_mobile == null
      ? !defaultSettings?.DISABLE_OFFLINE_MODE_DEFAULT_MOBILE
      : userOverride?.allowed_offline_mobile;
  const allowed_offline = isDesktop ? allowed_offline_desktop : allowed_offline_mobile;

  const defaultAutolockDelay =
    (isDesktop
      ? defaultSettings?.DEFAULT_AUTOLOCK_DELAY_DESKTOP
      : defaultSettings?.DEFAULT_AUTOLOCK_DELAY_MOBILE) || null;
  const maxAutolockDelay =
    (isDesktop
      ? defaultSettings?.MAX_AUTOLOCK_DELAY_DESKTOP
      : defaultSettings?.MAX_AUTOLOCK_DELAY_MOBILE) || null;
  return {
    allowed_to_export,
    allowed_offline,
    defaultAutolockDelay,
    maxAutolockDelay,
  };
};
