export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export class ImageGenerationService {
  /** Avec `source`, Gemini retouche cette image au lieu d'en créer une nouvelle. */
  static async generate(prompt: string, source?: GeneratedImage): Promise<GeneratedImage> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY manquant : impossible de générer une image');

    const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
    const parts: GeminiPart[] = [{ text: prompt }];
    if (source) parts.push({ inlineData: { mimeType: source.mimeType, data: source.data.toString('base64') } });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw new Error(`Gemini ${res.status} : ${body.error?.message ?? 'erreur inconnue'}`);

    const image = body.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData;
    if (!image) {
      const reason = body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? 'aucune image renvoyée';
      throw new Error(`Gemini n'a pas produit d'image (${reason})`);
    }
    return { data: Buffer.from(image.data, 'base64'), mimeType: image.mimeType };
  }

  static async download(url: string): Promise<GeneratedImage> {
    if (!url.startsWith('https://res.cloudinary.com/')) throw new Error('Seules les images hébergées sur Cloudinary peuvent être retouchées');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Image introuvable (${res.status})`);
    return { data: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get('content-type') ?? 'image/png' };
  }
}
