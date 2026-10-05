import test from 'node:test';
import assert from 'node:assert/strict';
import { toClaudeHistory } from './manager.service';

test('le manager retrouve les messages et images déjà produits dans l\'historique', () => {
  const history = toClaudeHistory([
    { role: 'user', text: 'Une annonce pour vendredi', attachments: [], createdAt: new Date() },
    {
      role: 'assistant',
      text: 'Voilà !',
      attachments: [
        { kind: 'message', label: 'Message #1', content: '# Soirée Among Us' },
        { kind: 'image', label: 'Visuel sans texte', url: 'https://res.cloudinary.com/x.png' },
      ],
      createdAt: new Date(),
    },
  ]);

  assert.equal(history[0].content, 'Une annonce pour vendredi');
  assert.equal(history[1].role, 'assistant');
  assert.equal(
    history[1].content,
    'Voilà !\n\n[Message #1]\n# Soirée Among Us\n\n[Visuel sans texte : https://res.cloudinary.com/x.png]',
  );
});

test('un message sans texte ni pièce jointe ne part jamais vide', () => {
  const [message] = toClaudeHistory([{ role: 'assistant', text: '', attachments: [], createdAt: new Date() }]);
  assert.ok(String(message.content).length > 0);
});
