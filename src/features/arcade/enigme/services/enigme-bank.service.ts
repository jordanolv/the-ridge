import bank from '../data/enigmes.json';
import type { EnigmeType, Riddle } from '../models/enigme-state.model';

const ANAGRAM_WORDS = [
  'MONTAGNE', 'GLACIER', 'SOMMET', 'CASCADE', 'RIVIERE', 'VOLCAN', 'DESERT', 'PLANETE', 'GALAXIE', 'FUSEE',
  'SATELLITE', 'ORDINATEUR', 'CLAVIER', 'INTERNET', 'PROGRAMME', 'MUSIQUE', 'GUITARE', 'CINEMA', 'THEATRE', 'PEINTURE',
  'CHOCOLAT', 'FROMAGE', 'BAGUETTE', 'CROISSANT', 'OMELETTE', 'RACLETTE', 'TARTIFLETTE', 'FONDUE', 'ELEPHANT', 'GIRAFE',
  'DAUPHIN', 'PANTHERE', 'KANGOUROU', 'PINGOUIN', 'PAPILLON', 'LIBELLULE', 'TORTUE', 'CROCODILE', 'BICYCLETTE', 'VOITURE',
  'CAMION', 'BATEAU', 'PARACHUTE', 'ESCALIER', 'FENETRE', 'CHEMINEE', 'JARDIN', 'BIBLIOTHEQUE', 'HOPITAL', 'CHAMPION',
  'MEDAILLE', 'TROPHEE', 'AVENTURE', 'MYSTERE', 'TRESOR', 'PIRATE', 'DRAGON', 'LICORNE', 'SORCIER', 'CHEVALIER',
  'PRINCESSE', 'CHATEAU', 'VILLAGE', 'CAPITALE', 'TELEPHONE', 'CAMERA', 'LUMIERE', 'TEMPETE', 'TONNERRE', 'AVALANCHE',
  'ESCALADE', 'RANDONNEE', 'REFUGE', 'SENTIER', 'FALAISE', 'CANYON', 'TUNNEL', 'PYRAMIDE', 'CATHEDRALE', 'AQUARIUM',
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: T[]): T => arr[rand(arr.length)];
const between = (min: number, max: number) => min + rand(max - min + 1);

/** Normalise pour comparer : minuscules, sans accents, sans ponctuation ni espaces. */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]/g, '');
}

function shuffleLetters(word: string): string {
  const letters = word.split('');
  let out = word;
  for (let tries = 0; tries < 10 && out === word; tries++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    out = letters.join('');
  }
  return out;
}

function generateAnagramme(): Riddle {
  const word = pick(ANAGRAM_WORDS);
  return {
    type: 'anagramme',
    question: `Remets les lettres dans l'ordre :\n## ${shuffleLetters(word).split('').join(' ')}`,
    answers: [word],
    hint: `Le mot commence par **${word[0]}** et finit par **${word[word.length - 1]}**.`,
  };
}

type SuitePattern = { terms: number[]; hint: string };

const SUITE_PATTERNS: (() => SuitePattern)[] = [
  () => {
    const start = between(1, 30);
    const step = between(3, 12);
    return { terms: Array.from({ length: 6 }, (_, i) => start + i * step), hint: 'On ajoute toujours la même chose.' };
  },
  () => {
    const start = between(1, 5);
    const ratio = between(2, 3);
    return { terms: Array.from({ length: 6 }, (_, i) => start * ratio ** i), hint: 'On multiplie toujours par le même nombre.' };
  },
  () => {
    const offset = between(1, 6);
    return { terms: Array.from({ length: 6 }, (_, i) => (i + offset) ** 2), hint: 'Pense aux carrés.' };
  },
  () => {
    const a = between(1, 5);
    const b = between(a + 1, 9);
    const terms = [a, b];
    while (terms.length < 6) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
    return { terms, hint: 'Chaque terme dépend des deux précédents.' };
  },
  () => {
    const start = between(1, 20);
    const stepA = between(2, 6);
    const stepB = between(7, 15);
    const terms = [start];
    while (terms.length < 6) terms.push(terms[terms.length - 1] + (terms.length % 2 === 1 ? stepA : stepB));
    return { terms, hint: 'Deux pas différents qui alternent.' };
  },
  () => {
    const start = between(1, 10);
    const terms = [start];
    for (let i = 1; i < 6; i++) terms.push(terms[i - 1] + i + 1);
    return { terms, hint: "L'écart entre deux termes grandit d'un à chaque fois." };
  },
  () => {
    const offset = between(1, 5);
    return { terms: Array.from({ length: 6 }, (_, i) => (i + offset) ** 2 - 1), hint: 'Des carrés… à un détail près.' };
  },
  () => {
    const start = between(50, 120);
    const step = between(4, 9);
    return { terms: Array.from({ length: 6 }, (_, i) => start - i * step), hint: 'Ça descend régulièrement.' };
  },
];

function generateSuite(): Riddle {
  const { terms, hint } = pick(SUITE_PATTERNS)();
  const shown = terms.slice(0, 5);
  return {
    type: 'suite',
    question: `Quel est le nombre suivant ?\n## ${shown.join(' · ')} · ?`,
    answers: [String(terms[5])],
    hint,
  };
}

function generateCalcul(): Riddle {
  let value = between(5, 25);
  const steps: string[] = [`Prends **${value}**`];
  const values: number[] = [value];
  const ops: (() => boolean)[] = [
    () => { const n = between(2, 4); value *= n; steps.push(`multiplie par **${n}**`); return true; },
    () => { const n = between(7, 39); value += n; steps.push(`ajoute **${n}**`); return true; },
    () => { if (value < 6) return false; const n = between(3, Math.min(20, value - 2)); value -= n; steps.push(`retire **${n}**`); return true; },
    () => { const d = [2, 3, 5].filter((n) => value % n === 0 && value / n > 1); if (d.length === 0) return false; const n = pick(d); value /= n; steps.push(`divise par **${n}**`); return true; },
  ];
  while (values.length < 5) {
    if (pick(ops)()) values.push(value);
  }
  return {
    type: 'calcul',
    question: `Calcul mental, sans calculatrice :\n${steps.join(', ')}.\n**Quel est le résultat ?**`,
    answers: [String(value)],
    hint: `Après les deux premières opérations, tu dois être à **${values[2]}**. Continue !`,
  };
}

const GENERATORS: Record<'suite' | 'anagramme' | 'calcul', () => Riddle> = {
  suite: generateSuite,
  anagramme: generateAnagramme,
  calcul: generateCalcul,
};

const BANK = bank as Riddle[];

export const ENIGME_TYPE_LABELS: Record<EnigmeType, string> = {
  suite: '🔢 Suite logique',
  anagramme: '🔤 Anagramme',
  calcul: '🧮 Calcul mental',
  devinette: '💭 Devinette',
  charade: '🎭 Charade',
  emoji: '🔣 Rébus emoji',
};

export class EnigmeBankService {
  /** Un type au hasard, puis une énigme de ce type (générée ou piochée dans la banque). */
  static pickRiddle(): Riddle {
    const type = pick(Object.keys(ENIGME_TYPE_LABELS) as EnigmeType[]);
    if (type in GENERATORS) return GENERATORS[type as keyof typeof GENERATORS]();

    return pick(BANK.filter((r) => r.type === type));
  }

  static isCorrect(riddle: Riddle, raw: string): boolean {
    const given = normalizeAnswer(raw);
    return given.length > 0 && riddle.answers.some((a) => normalizeAnswer(a) === given);
  }
}
