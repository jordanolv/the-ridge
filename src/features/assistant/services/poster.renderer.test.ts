import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPoster, titleSize } from './poster.renderer';

test('le titre rétrécit avec sa longueur, dans des bornes lisibles', () => {
  assert.equal(titleSize('Rocket'), 112);
  assert.ok(titleSize('Une très longue soirée Among Us entre Campeurs') < 112);
  assert.equal(titleSize('x'.repeat(200)), 56);
});

test('l\'affiche se rend en PNG 1280×720 par-dessus un fond', async () => {
  const poster = await renderPoster(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    'Soirée Among Us',
    'Vendredi 10 octobre · 21h',
  );
  assert.equal(poster.subarray(1, 4).toString(), 'PNG');
  assert.equal(poster.readUInt32BE(16), 1280);
  assert.equal(poster.readUInt32BE(20), 720);
});
