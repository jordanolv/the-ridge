export const ENIGME_SPAWN_HOUR = 12;
export const ENIGME_REVEAL_HOUR = 21;

export const ENIGME_MAX_ATTEMPTS = 3;

/** 🥇 🥈 🥉 — ordre d'arrivée des bonnes réponses */
export const ENIGME_PODIUM_REWARDS = [
  { money: 40, xp: 600, expeditions: 4 },
  { money: 25, xp: 300, expeditions: 2 },
  { money: 15, xp: 150, expeditions: 1 },
];

/** Bonne réponse hors podium */
export const ENIGME_SOLVER_FRAGMENTS = 10;
/** A tenté sans trouver */
export const ENIGME_PARTICIPATION_FRAGMENTS = 5;

export const ENIGME_REVEAL_BUTTON_ID = 'enigme:reveal';
export const ENIGME_HINT_BUTTON_ID = 'enigme:hint';
export const ENIGME_BUTTON_ID = 'enigme:answer';
export const ENIGME_MODAL_ID = 'enigme:modal';

export const ENIGME_ACCENT_COLOR = 0xb388eb;
export const ENIGME_FINISHED_ACCENT_COLOR = 0x57cc99;
