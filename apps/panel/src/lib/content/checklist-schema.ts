import { z } from 'zod';

/** Metinler templates/pre-publish-checklist.md ile birlikte güncellenir. */
export const checklistGroups = [
  {
    title: '1. İzlenme kancası',
    score: 'hookScore',
    items: [
      [
        'hook_opening',
        'İlk 1–3 saniyede belirgin bir görsel veya metinsel kanca var.',
      ],
      [
        'hook_character',
        'İlk karede karakter net; boş veya karanlık açılış yok.',
      ],
      ['hook_pacing', 'Ortada 3 saniyeden uzun durağan bölüm yok.'],
      ['hook_payoff', 'Sonda merak ödülü, twist veya payoff var.'],
      ['hook_loop', 'Loop varsa son kare ilk kareye doğal bağlanıyor.'],
    ],
  },
  {
    title: '2. Yorum/paylaşım nedeni',
    score: 'engagementScore',
    items: [
      [
        'engagement_reason',
        'İçerik izleyiciye yorum veya paylaşım için doğal bir neden veriyor.',
      ],
      [
        'engagement_caption',
        'Caption persona tonunda; gerekiyorsa açık bir soru/CTA içeriyor.',
      ],
      [
        'engagement_hashtags',
        'Caption şablonu hazır; 3–5 alakalı hashtag seçildi ve hashtag sayfaları kısıtlı değil.',
      ],
      ['engagement_honesty', 'Yapay tartışma veya yanıltıcı iddia yaratmıyor.'],
    ],
  },
  {
    title: '3. Teknik kalite',
    score: null,
    items: [
      [
        'quality_format',
        '9:16 ve platformun güncel çözünürlük şartlarına uygun.',
      ],
      [
        'quality_anatomy',
        "Yüz, uzuv, metin ve hareket artefaktları QC'den geçti.",
      ],
      ['quality_text', 'Ekran yazısı güvenli alanda; altyazı okunaklı.'],
      ['quality_silent', 'Sessizde izleyici mesajı anlayabiliyor.'],
      [
        'quality_audio',
        'Ses seviyesi dengeli; ses/müzik bu platform ve kullanım türü için lisanslı.',
      ],
      ['quality_cover', 'Kapak karesi seçildi.'],
    ],
  },
  {
    title: '4. AI ve doğruluk açıklaması',
    score: null,
    items: [
      [
        'ai_disclosure',
        'Gerçekçi AI üretimi ise platformun AI / altered-content açıklaması açıldı.',
      ],
      [
        'ai_identity',
        'Bio ve içerik kurgusal AI karakter olduğunu gizlemiyor.',
      ],
      [
        'ai_consent',
        'Gerçek kişi/marka/kurum taklidi veya izinsiz yüz/ses kullanımı yok.',
      ],
      [
        'ai_claims',
        'Gerçek olmayan ürün deneyimi, sağlık/finans/haber iddiası yok.',
      ],
      [
        'ai_brands',
        'Görseldeki markalar, ürünler, mekânlar ve iddialar kontrol edildi.',
      ],
    ],
  },
  {
    title: '5. Ticari, telif ve güvenlik',
    score: null,
    items: [
      [
        'commercial_disclosure',
        'Ücret, hediye, indirim, davet veya başka menfaat varsa açık “reklam” / “tanıtım” ibaresi eklendi.',
      ],
      [
        'commercial_tool',
        'Platformun ücretli ortaklık/branded-content aracı gerekiyorsa etkinleştirildi.',
      ],
      [
        'commercial_rights',
        'Kaynak ve kullanım izni kaydedildi; üçüncü taraf video/ses kullanım hakkı doğrulandı.',
      ],
      [
        'commercial_engagement',
        'Bot, satın alınmış etkileşim, engagement pod veya yanıltıcı CTA yok.',
      ],
      [
        'commercial_minor',
        'Reşit olmayan ya da çocuk gibi görünen karakteri cinselleştiren içerik yok.',
      ],
    ],
  },
] as const;

export const checklistKeys = checklistGroups.flatMap((g) =>
  g.items.map(([key]) => key),
);
export const checklistSchema = z.object({
  items: z
    .record(z.string(), z.boolean())
    .refine((items) =>
      Object.keys(items).every((key) =>
        (checklistKeys as string[]).includes(key),
      ),
    )
    .default({}),
  hookScore: z.number().int().min(1).max(5).nullable().default(null),
  engagementScore: z.number().int().min(1).max(5).nullable().default(null),
  decision: z.enum(['ready', 'rework', 'review']).default('review'),
});
export type ContentChecklist = z.infer<typeof checklistSchema>;
export function readChecklist(value: unknown): ContentChecklist {
  const result = checklistSchema.safeParse(value);
  return result.success ? result.data : checklistSchema.parse({});
}
