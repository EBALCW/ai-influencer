// Üretim makinesi yetenek anahtarları (#212). İş kuyruğu (`jobs.required_capabilities`) ve
// makine kaydı (`production_workers.capabilities`) bu anahtarlarla eşleşir; anahtar adı
// değiştirilmez, yalnız yenisi eklenir. Hangi araçtan türediği: apps/worker/src/lib/capabilities.ts.
// Bu dosya başka dosya içe aktarmaz: hem panel (bundler) hem makine programı (Node) doğrudan okur.

export const WORKER_CAPABILITIES = [
  'voice.edge-tts',
  'captions.burn',
  'render.skia',
  'render.hyperframes',
  'render.blender',
  'render.blender.mpfb',
  'clip.cut',
  'clip.transcribe',
  'clip.audio-tags',
  'fetch.youtube',
] as const;

export type WorkerCapability = (typeof WORKER_CAPABILITIES)[number];

export const WORKER_CAPABILITY_LABELS: Record<WorkerCapability, string> = {
  'voice.edge-tts': 'Türkçe seslendirme (edge-tts)',
  'captions.burn': 'Altyazı gömme (libass + libx264)',
  'render.skia': 'Skia yolu ile 2B anlatım render',
  'render.hyperframes': 'Stil yolu (HyperFrames) render',
  'render.blender': 'Blender ile 3B kesit render',
  'render.blender.mpfb': 'Blender + MPFB insan figürü',
  'clip.cut': 'Klip kesme ve dikeye çevirme',
  'clip.transcribe': 'Yerel konuşma tanıma (whisper.cpp)',
  'clip.audio-tags': 'Ses etiketleme (müzik, gülme, bağırma)',
  'fetch.youtube': 'YouTube video ve altyazı indirme',
};

export function isWorkerCapability(value: string): value is WorkerCapability {
  return (WORKER_CAPABILITIES as readonly string[]).includes(value);
}
