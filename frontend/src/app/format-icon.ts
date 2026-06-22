const ICONS: Record<string, string> = {
  print: 'menu_book',
  digital: 'tablet_mac',
  audio: 'headphones',
};

export function formatIcon(format: string): string {
  return ICONS[format] ?? '';
}
