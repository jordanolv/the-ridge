# AGENTS.md — The Ridge Bot

Les conventions du projet vivent dans [`CLAUDE.md`](CLAUDE.md) : stack, architecture,
patterns, style de code. Les lire avant toute review ou modification. Ce fichier n'ajoute
que ce qui concerne la review.

## Review guidelines

Écrire la review en français.

Les PR partent d'une branche `feat/*` ou `fix/*` vers `dev` (staging), puis de `dev` vers
`main` (prod). Une PR `dev` → `main` ne fait que promouvoir du code déjà relu : se
concentrer sur ce qui n'aurait pas sa place en prod.

### À signaler en priorité (P0 / P1)

- **Argent.** Tout changement de `profil.money`, d'une récompense ou d'un prix se lit
  contre [`docs/economy.md`](docs/economy.md) et [`docs/shop.md`](docs/shop.md). Signaler :
  - un mouvement d'argent qui ne passe pas par `LogService.economy`, directement ou via
    `UserService.updateUserMoney`. Exception : le remboursement qui annule un débit jamais
    journalisé (livraison ratée en boutique, `docs/shop.md`) ne laisse volontairement aucune trace ;
  - un mauvais `flow` : `mint` (création), `burn` (destruction), `transfer` (entre
    joueurs, des deux côtés) ;
  - un montant qui peut devenir fractionnaire sans être arrondi avant écriture ;
  - une nouvelle source de revenu, ou une prime qui ne correspond ni à la bande ni aux
    valeurs déjà validées de `economy.md` §6 (raids 20/50/100, daily 0–10 en font partie) ;
  - une violation des invariants de `economy.md` §4 : paie indexée sur les qualifiés et
    pas sur `users.length`, scores lus avant le reset des `activityPoints`, paie idempotente ;
  - un moyen de faire passer de l'argent d'un compte à l'autre hors des bets (perdre
    exprès, rejouer une interaction, double clic).
- **Concurrence et double exécution.** Interactions Discord cliquées deux fois, crons
  relancés au redémarrage, lecture puis écriture non atomique sur un solde.
- **Ownership des interactions.** Un bouton ou un menu doit vérifier que celui qui
  clique a le droit d'agir (`interaction.message.interactionMetadata?.user.id`).
- **Sécurité du serveur web.** Une route qui lit ou modifie des données de joueur ou de
  config sans authentification, un secret exposé au front. Les mécanismes en place :
  `requireAdmin` (dashboard), `requireActivityUser` (Activity), et le JWT signé par
  `WebService.generateMapUrl` (carte `/api/map/*`). Sont publiques par conception, ne pas les signaler :
  `POST /api/admin/login`, `POST /api/activity/token` (l'amorçage de l'auth),
  `/api/activity/config`, et les images relayées (`brand`, `avatar`, `mountains/:id/image`,
  `parties/:id/image`, `mapbox/*`), chargées par le navigateur ou Mapbox sans jeton.
- **Données.** Changement de modèle TypeGoose sans prise en compte des documents
  existants ; renommage d'un préfixe de `customId` (`mountain:` notamment) sans migration.

### À signaler aussi (P2)

- Une feature qui importe directement depuis une autre feature (passer par `shared/`,
  le bus d'events ou un plugin).
- Un commentaire qui paraphrase le code, une section décorative, un TODO sans ticket :
  `CLAUDE.md` § Style de code est strict là-dessus.
- `ephemeral: true` au lieu de `flags: MessageFlags.Ephemeral`, un nouvel `EmbedBuilder`
  là où Components V2 convient.
- Une entrée de patchnote qui décrit un changement invisible pour les joueurs.

### À ne pas signaler

- Le style que le build ne vérifie pas et que `CLAUDE.md` ne mentionne pas.
- Les textes affichés aux joueurs en français : c'est voulu.
