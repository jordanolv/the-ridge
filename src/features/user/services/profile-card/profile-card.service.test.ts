import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProfileCardService } from './profile-card.service';

test('generateCard rend un PNG 1500×900 sans réseau, même avec des données extrêmes', async () => {
  const png = await ProfileCardService.generateCard({
    pseudo: 'Un pseudo vraiment beaucoup trop long pour tenir sur la carte',
    bio: '',
    ridgecoin: '123 456 789',
    level: '999',
    messages: '0',
    voc: '0',
    birthday: 'Non défini',
    joinedAt: '01/2020',
    avatarUrl: '',
    roles: Array.from({ length: 40 }, (_, i) => ({ name: `Rôle numéro ${i}`, color: '#000000' })),
    weeklyActivity: [],
    mountains: [],
    xp: { current: 0, required: 100, percent: 0 },
  });

  assert.deepEqual([...png.subarray(1, 4)], [...Buffer.from('PNG')]);
  assert.equal(png.readUInt32BE(16), 1500);
  assert.equal(png.readUInt32BE(20), 900);
});
