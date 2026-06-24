export function requestSettings(sendMessage: (message: object) => void): void {
  sendMessage({ command: 'get_settings' });
}

export function setSetting(
  sendMessage: (message: object) => void,
  key: string,
  value: number
): void {
  sendMessage({ command: 'set_setting', key, value });
}

export function setSettings(
  sendMessage: (message: object) => void,
  values: Record<string, number>
): void {
  sendMessage({ command: 'set_settings', values });
}
