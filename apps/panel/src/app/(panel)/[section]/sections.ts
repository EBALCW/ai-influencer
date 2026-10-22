// Panel bölümleri. Listede olmayan adres [section]/layout.tsx'te 404 döner.
export const sections: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  production: {
    title: 'Üretim',
    description: 'Görsel ve video üretimlerinizi buradan takip edin.',
    icon: '▷',
  },
  brands: {
    title: 'Markalar',
    description: 'Marka iş birliklerini ve medya kitinizi yönetin.',
    icon: '◇',
  },
};
