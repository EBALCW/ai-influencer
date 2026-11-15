// Panel bölümleri. Listede olmayan adres [section]/layout.tsx'te 404 döner.
export const sections: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  // Anlatım modülünün ekranları (#217, #218) bir sonraki PR'da bu girdinin yerini alır.
  explainers: {
    title: 'Anlatım videoları',
    description:
      'Seriler, tekil videolar, konu önerileri ve senaryo onayı burada toplanır.',
    icon: '✎',
  },
};
