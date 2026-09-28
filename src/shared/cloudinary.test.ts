import { test } from 'node:test';
import assert from 'node:assert/strict';
// Importé avant que les variables d'env existent, comme dans le bot où
// dotenv.config() ne tourne qu'après l'évaluation du graphe d'imports.
import { cloudinaryConfig } from './cloudinary';

test('la config cloudinary est lue à l\'appel, pas à l\'import', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'cloud-de-test';
  process.env.CLOUDINARY_API_KEY = 'cle-de-test';

  const config = cloudinaryConfig();

  assert.equal(config.cloud_name, 'cloud-de-test');
  assert.equal(config.api_key, 'cle-de-test');
});
