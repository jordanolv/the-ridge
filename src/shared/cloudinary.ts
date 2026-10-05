import { v2 as cloudinary } from 'cloudinary';

/**
 * La config est relue à chaque appel, jamais à l'import : `dotenv.config()` tourne
 * dans le corps de `src/index.ts`, donc après l'évaluation de tout le graphe
 * d'imports. Configurer ici au chargement du module donnerait des `undefined`.
 */
function client() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export function cloudinaryConfig() {
  return client().config();
}

export async function uploadFromUrl(url: string, folder: string, publicId?: string): Promise<string> {
  const options: Record<string, any> = { folder };
  if (publicId) options.public_id = publicId;

  const result = await client().uploader.upload(url, options);
  return result.secure_url;
}

export async function uploadFile(filePath: string, folder: string, publicId: string): Promise<string> {
  const result = await client().uploader.upload(filePath, { folder, public_id: publicId, overwrite: false });
  return result.secure_url;
}

/** URL de l'asset s'il existe déjà, null sinon. */
export async function findAsset(publicId: string): Promise<string | null> {
  try {
    const result = await client().api.resource(publicId);
    return result.secure_url;
  } catch {
    return null;
  }
}

export async function uploadBuffer(data: Buffer, mimeType: string, folder: string): Promise<string> {
  const result = await client().uploader.upload(`data:${mimeType};base64,${data.toString('base64')}`, { folder });
  return result.secure_url;
}
