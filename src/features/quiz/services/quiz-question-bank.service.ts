import * as fs from 'fs';
import * as path from 'path';
import { formatInTimeZone } from 'date-fns-tz';
import { MountainService, MountainInfo } from '../../peak-hunters/services/mountain.service';
import { QuizQuestion } from './quiz.service';

interface BankQuestion {
  id: string;
  category: string;
  theme: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

type SpecialQuestion = Omit<BankQuestion, 'id' | 'category'> & { subtheme?: string };

export const MOUNTAIN_THEME = '🏔️ Montagne';

const CATEGORY_LABELS: Record<string, string> = {
  'culture-g': '🧠 Culture G',
  'geographie': '🌍 Géographie',
  'animaux': '🐾 Animaux',
  'faune-flore': '🌿 Faune & Flore',
  'musique': '🎵 Musique',
  'jeux-video': '🎮 Jeux vidéo',
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0 && i >= copy.length - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(-n);
}

function altitudeOf(m: MountainInfo): number {
  return Math.round(parseFloat(m.elevation));
}

/** Sommets les plus proches en altitude (altitudes et labels distincts) → leurres plausibles. */
function nearestByAltitude(all: MountainInfo[], target: MountainInfo, poolSize: number): MountainInfo[] {
  const targetAlt = altitudeOf(target);
  const seenAlts = new Set<number>([targetAlt]);
  const seenLabels = new Set<string>([target.mountainLabel]);
  return all
    .filter((m) => m.id !== target.id)
    .sort((a, b) => Math.abs(altitudeOf(a) - targetAlt) - Math.abs(altitudeOf(b) - targetAlt))
    .filter((m) => {
      const alt = altitudeOf(m);
      if (seenAlts.has(alt) || seenLabels.has(m.mountainLabel)) return false;
      seenAlts.add(alt);
      seenLabels.add(m.mountainLabel);
      return true;
    })
    .slice(0, poolSize);
}

export function shuffleQuizChoices(question: QuizQuestion): QuizQuestion {
  const pairs = question.choices.map((text, i) => ({ text, isCorrect: i === question.answer }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
  }
  const choices = pairs.map((p) => p.text);
  const answer = pairs.findIndex((p) => p.isCorrect);
  return { ...question, choices, answer };
}

function photoQuestion(all: MountainInfo[]): QuizQuestion {
  const m = pick(all);
  const others = all.filter((x) => x.mountainLabel !== m.mountainLabel);
  const sameRarity = others.filter((x) => x.rarity === m.rarity);
  const distractors = sample(sameRarity.length >= 3 ? sameRarity : others, 3);
  return shuffleQuizChoices({
    id: `photo:${m.id}`,
    question: 'Quelle est cette montagne ?',
    choices: [m.mountainLabel, ...distractors.map((x) => x.mountainLabel)],
    answer: 0,
    explanation: `${m.mountainLabel} — ${MountainService.getAltitude(m)} · ${MountainService.getCountryDisplay(m)}`,
    image: m.image,
    theme: MOUNTAIN_THEME,
    subtheme: 'Photo mystère',
  });
}

function altitudeQuestion(all: MountainInfo[]): QuizQuestion {
  const m = pick(all);
  const distractors = sample(nearestByAltitude(all, m, 12), 3);
  return shuffleQuizChoices({
    id: `altitude:${m.id}`,
    question: `Quelle est l'altitude du sommet **${m.mountainLabel}** (${MountainService.getCountryDisplay(m)}) ?`,
    choices: [m, ...distractors].map((x) => MountainService.getAltitude(x)),
    answer: 0,
    explanation: `${m.mountainLabel} culmine à ${MountainService.getAltitude(m)}.`,
    image: null,
    theme: MOUNTAIN_THEME,
    subtheme: 'Altitude',
  });
}

function countryQuestion(all: MountainInfo[]): QuizQuestion {
  const m = pick(all);
  const otherCountries = [...new Set(all.flatMap((x) => x.countries))].filter(
    (c) => !m.countries.includes(c),
  );
  return shuffleQuizChoices({
    id: `country:${m.id}`,
    question: `Dans quel pays se trouve le sommet **${m.mountainLabel}** (${MountainService.getAltitude(m)}) ?`,
    choices: [m.countries[0]!, ...sample(otherCountries, 3)],
    answer: 0,
    explanation: `${m.mountainLabel} se trouve en ${MountainService.getCountryDisplay(m)}.`,
    image: null,
    theme: MOUNTAIN_THEME,
    subtheme: 'Pays',
  });
}

function highestQuestion(all: MountainInfo[]): QuizQuestion {
  const anchor = pick(all);
  const contenders = [anchor, ...sample(nearestByAltitude(all, anchor, 8), 3)];
  const winner = contenders.reduce((a, b) => (altitudeOf(a) >= altitudeOf(b) ? a : b));
  return shuffleQuizChoices({
    id: `highest:${winner.id}`,
    question: 'Lequel de ces sommets est le plus haut ?',
    choices: contenders.map((x) => x.mountainLabel),
    answer: contenders.indexOf(winner),
    explanation: `${winner.mountainLabel} culmine à ${MountainService.getAltitude(winner)} (${MountainService.getCountryDisplay(winner)}).`,
    image: null,
    theme: MOUNTAIN_THEME,
    subtheme: 'Duel de sommets',
  });
}

function higherLowerQuestion(all: MountainInfo[]): QuizQuestion {
  const a = pick(all);
  const b = pick(nearestByAltitude(all, a, 6));
  const [winner, loser] = altitudeOf(a) >= altitudeOf(b) ? [a, b] : [b, a];
  return {
    id: `hl:${[a.id, b.id].sort().join(':')}`,
    question: 'Lequel de ces deux sommets culmine le plus haut ?',
    choices: [a.mountainLabel, b.mountainLabel],
    answer: [a, b].indexOf(winner),
    explanation: `${winner.mountainLabel} (${MountainService.getAltitude(winner)}) devance ${loser.mountainLabel} (${MountainService.getAltitude(loser)}).`,
    image: null,
    theme: MOUNTAIN_THEME,
    subtheme: 'Plus haut ou plus bas',
  };
}

const MOUNTAIN_FORMATS = [photoQuestion, altitudeQuestion, countryQuestion, highestQuestion, higherLowerQuestion];

export class QuizQuestionBankService {
  private static bank: BankQuestion[] = [];
  private static specials: Record<string, SpecialQuestion> = {};

  static {
    try {
      const filePath = path.join(__dirname, '../data/questions.json');
      QuizQuestionBankService.bank = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error('[QuizQuestionBank] Erreur chargement questions.json:', err);
    }
    try {
      const filePath = path.join(__dirname, '../data/special-questions.json');
      QuizQuestionBankService.specials = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error('[QuizQuestionBank] Erreur chargement special-questions.json:', err);
    }
  }

  /** Question unique prévue pour aujourd'hui (date de Paris) : remplace le choix de thèmes. */
  static todaySpecial(): QuizQuestion | null {
    const day = formatInTimeZone(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
    const special = this.specials[day];
    if (!special) return null;
    return shuffleQuizChoices({
      id: `special:${day}`,
      question: special.question,
      choices: special.choices,
      answer: special.answer,
      explanation: special.explanation,
      image: null,
      theme: special.theme,
      subtheme: special.subtheme,
    });
  }

  private static toQuizQuestion(q: BankQuestion): QuizQuestion {
    return shuffleQuizChoices({
      id: `bank:${q.id}`,
      question: q.question,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      image: null,
      theme: CATEGORY_LABELS[q.category] ?? q.category,
      subtheme: q.theme,
    });
  }

  private static mountainQuestion(): QuizQuestion {
    return pick(MOUNTAIN_FORMATS)(MountainService.getAll());
  }

  /** Le set du jour : Montagne garanti + (count - 1) catégories distinctes de la banque. */
  static generateSet(recentIds: string[], count = 4): QuizQuestion[] {
    const usedIds = new Set(recentIds);
    const questions: QuizQuestion[] = [];

    if (MountainService.getAll().length >= 10) {
      for (let tries = 0; tries < 20; tries++) {
        const q = this.mountainQuestion();
        if (usedIds.has(q.id)) continue;
        usedIds.add(q.id);
        questions.push(q);
        break;
      }
    }

    const categories = sample([...new Set(this.bank.map((q) => q.category))], count - questions.length);
    for (const category of categories) {
      const pool = this.bank.filter((q) => q.category === category && !usedIds.has(`bank:${q.id}`));
      if (pool.length === 0) continue;
      const q = this.toQuizQuestion(pick(pool));
      usedIds.add(q.id);
      questions.push(q);
    }

    return questions;
  }
}
