export interface SettingEnumOption {
  value: number;
  label: string;
}

export interface SettingDescriptor {
  id: number;
  key: string;
  title: string;
  visible: boolean;
  subline?: string;
  subline_dynamic?: string;
  allowed_values?: number[];
  range_min?: number;
  range_max?: number;
  enum_options?: SettingEnumOption[];
}

export interface SettingsSchema {
  entries: SettingDescriptor[];
}

export type SettingsValues = Record<string, number>;
