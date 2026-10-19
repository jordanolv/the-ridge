import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMentions, MentionNames } from './logs-render';

const names: MentionNames = {
  users: new Map([['111', 'Jordan']]),
  channels: new Map([['222', 'général']]),
  roles: new Map([['333', 'Campeur']]),
};

test('résout les mentions connues', () => {
  assert.equal(
    renderMentions('<@111> a parlé dans <#222> avec <@&333>', names),
    '@Jordan a parlé dans #général avec @Campeur',
  );
});

test('garde l\'id quand le nom est inconnu', () => {
  assert.equal(renderMentions('<@999>', names), '@999');
});

test('gère la forme <@!id>', () => {
  assert.equal(renderMentions('<@!111>', names), '@Jordan');
});

test('formate les timestamps Discord', () => {
  const rendered = renderMentions('expire <t:1700000000:R>', names);
  assert.match(rendered, /expire \d{2}\/\d{2}\/\d{4}/);
});
