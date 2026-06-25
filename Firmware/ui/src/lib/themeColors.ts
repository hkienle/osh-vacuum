/** Read a CSS custom property from :root (respects .dark). */
export function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chartColors(): { rpm: string; temp: string; voltage: string } {
  return {
    rpm: getCssVar('--chart-1') || '#818cf8',
    temp: getCssVar('--chart-2') || '#f472b6',
    voltage: getCssVar('--chart-3') || '#34d399',
  };
}
