// Panel bölümleri. Listede olmayan adres [section]/layout.tsx'te 404 döner.
export const sections: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  influencers: {
    title: 'Influencer’lar',
    description: 'Karakterlerinizi, profillerinizi ve bağlı hesapları yönetin.',
    icon: '✦',
  },
  content: {
    title: 'İçerik',
    description: 'Fikirden yayına içerik üretim adımlarını takip edin.',
    icon: '▤',
  },
  calendar: {
    title: 'Takvim',
    description: 'Planlanan ve yayınlanan içerikleri takvimde görüntüleyin.',
    icon: '▦',
  },
  analytics: {
    title: 'Analitik',
    description: 'Platform performansını ve büyüme metriklerini inceleyin.',
    icon: '⌁',
  },
  production: {
    title: 'Üretim',
    description: 'Görsel ve video üretimlerinizi buradan takip edin.',
    icon: '▷',
  },
  costs: {
    title: 'Maliyetler',
    description: 'Üretim ve abonelik maliyetlerinizi tek yerde izleyin.',
    icon: '₺',
  },
  brands: {
    title: 'Markalar',
    description: 'Marka iş birliklerini ve medya kitinizi yönetin.',
    icon: '◇',
  },
};
