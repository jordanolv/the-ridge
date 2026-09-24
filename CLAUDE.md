# CLAUDE.md — The Ridge Bot

Bot Discord communautaire du serveur The Ridge. TypeScript, Discord.js v14, MongoDB/TypeGoose, Docker/Dokploy.

## Stack

- **Runtime** : Node.js 22, TypeScript, `@swc-node/register` (pas de build en dev), nodemon pour le watch
- **Discord** : discord.js v14, Components V2 (ContainerBuilder, SectionBuilder, etc.)
- **Base de données** : MongoDB via Mongoose + TypeGoose
- **Cron** : package `cron` v4 (`CronJob`)
- **Déploiement** : Docker (`Dockerfile`) via Dokploy
- **Timezone** : Europe/Paris pour tous les crons

## Lancer le bot

```bash
npm run dev      # swc, pas de build
npm run watch    # idem + rechargement à chaud
npm run build    # tsc + tsc-alias + copie des assets — ce que vérifie la CI
```

Les variables d'env sont dans `.env` (ne jamais committer).

## Git et environnements

| Env | Branche | Environnement Dokploy |
|---|---|---|
| Production | `main` | projet The Ridge → `production` |
| Staging | `dev` | projet The Ridge → `staging` |

```
feat/xxx ──PR──► dev ──PR──► main
                  │            │
               staging        prod
```

`main` et `dev` sont protégées : PR obligatoire, CI (`npm run build`) verte, pas de
force-push (`enforce_admins` actif : la protection s'applique aussi aux admins).
Jamais de commit direct sur ces deux branches — brancher depuis `dev`. Un hook
`PreToolUse` (`.claude/hooks/block-direct-main-dev.sh`) refuse tout `git commit` /
`git push` fait depuis `main` ou `dev`, ou poussé explicitement vers elles.

Le merge sur `dev` déploie staging, le merge sur `main` déploie la prod. Promotion
`dev` → `main` en **merge commit**, pas en squash : un squash ferait diverger les
deux branches définitivement.

Dokploy redéploie sur webhook GitHub. Aucun workflow de déploiement dans le repo —
ne pas en réintroduire. Les variables d'env vivent dans l'onglet *Environment* de
chaque application Dokploy, et chaque environnement a son propre bot et son propre
serveur Discord.

## Architecture

```
src/
├── bot/           # Client Discord, handlers events/features
├── config/        # commands.json
├── features/      # Une feature = un dossier autonome — `ls src/features/`
│   └── discord/   # Events globaux (ready, messageCreate, interactionCreate)
├── shared/        # cron, logs, guild, db, hooks, time, components, weekly-recap
└── web/           # Dashboard admin (Express + public/admin.html)
```

Noms de dossiers qui ne se devinent pas :

- `peak-hunters` — le système de montagnes (s'appelait `mountain`)
- `party` — les sessions vocales (s'appelait `vocal-party`)

Chaque feature suit la même structure :

```
feature/
├── models/        # TypeGoose models (Mongoose)
├── repositories/  # Accès BDD (findById, create, update...)
├── services/      # Logique métier
├── slash/         # Commandes slash Discord
├── cron/          # Jobs planifiés
└── events/        # Event listeners Discord
```

## Patterns clés

### Modèles TypeGoose

```ts
import { prop, getModelForClass } from '@typegoose/typegoose';
import { DocumentType } from '@typegoose/typegoose';

class MyModel {
  @prop({ required: true })
  field!: string;

  @prop({ default: 0 })
  count!: number;
}

const MyModelDB = getModelForClass(MyModel, {
  schemaOptions: { collection: 'my_collection' },
});

export type IMyModel = DocumentType<MyModel>;
export default MyModelDB;
```

### Dashboard admin

Toute l'administration passe par le dashboard web (`/admin`, port `WEB_PORT`), protégé
par `ADMIN_PASSWORD` + JWT (`WEB_JWT_SECRET`). Il n'y a plus de panels de config dans
Discord : le forum `⚙️┃config-bot` et le système `ConfigPanel` ont été supprimés.

```
src/web/
├── server.ts              # Express, sert /admin et /map
├── auth.ts                # requireAdmin (JWT) partagé par les routes
├── routes/admin.route.ts  # config des features, actions, joueurs
├── routes/logs.route.ts   # journal + agrégats économie
└── public/admin.html      # UI complète (vanilla, un seul fichier)
```

Ajouter un réglage = une entrée dans `GET /api/admin/config`, une branche dans
`POST /api/admin/config/:feature`, et une carte dans `admin.html`.

### Logs

`LogService` écrit dans la collection `bot_logs` (TTL 90 jours), plus rien dans Discord.

```ts
await LogService.info('message', { feature: 'party', title: 'Soirée créée' });
await LogService.economy(userId, amount, 'Bingo — gain', 'arcade', 'mint');
```

- `kind` classe l'entrée (`app`, `economy`, `message.delete`, `member.join`…) et sert de filtre côté dashboard.
- Tout mouvement d'argent doit passer par `LogService.economy` — soit via
  `UserService.updateUserMoney(discordId, amount, reason, flow)`, soit par un appel explicite
  quand le `$inc` est fait à la main. Sans ça la page Économie ment.
- Le `flow` dit ce que le mouvement fait à la masse monétaire : `mint` (création, défaut),
  `burn` (destruction), `transfer` (circulation entre joueurs, masse inchangée). Un pari PvP
  ou un duel d'arcade est un `transfer` des deux côtés — le compter en `mint`/`burn`
  gonflerait l'inflation affichée.
- Les messages sont écrits en markup Discord (`<@id>`, `<#id>`) ; `renderMentions`
  (`src/web/logs-render.ts`) les résout côté serveur pour le dashboard.

### Cron managers

```ts
// cron/my-feature.cron.ts
export class MyFeatureCron {
  private job: CronJob;

  constructor(client: BotClient) {
    this.job = new CronJob('0 0 0 * * 1', this.run.bind(this), null, false, 'Europe/Paris');
  }

  public start() { this.job.start(); }
  public stop() { this.job.stop(); }
  private async run() { ... }
}

// cron/index.ts
export class MyFeatureCronManager {
  static start(client: BotClient) { new MyFeatureCron(client).start(); }
}
```

Enregistrement dans `src/shared/cron/cron-manager.ts`.

### VoicePlugin

Pour hooker dans les sessions vocales, implémenter `VoicePlugin` et enregistrer dans le VoicePluginManager. Les hooks disponibles : `onSessionStart`, `onSessionEnd`, `onTick`.

## Modèle User — champs importants

```ts
stats: {
  totalMsg: number           // total messages bruts
  messageHistory: [{ date, count }]  // 1 entrée par jour, tous les messages
  voiceTime: number          // total secondes de voc (cumulatif)
  voiceHistory: [{ date, time }]     // 1 entrée par jour, secondes de voc
  activityPoints: number     // points semaine en cours (voc + msgs), reset lundi
  dailyStreak: number
  arcade: { shifumi, puissance4, morpion, battle }
}
profil: { money, exp, lvl }
```

## Système activityPoints

Chaque lundi minuit (Paris), `ActivityRolesService.run()` :

1. Lit `activityPoints` sur chaque user
2. Trie et attribue les rôles selon les seuils %
3. Reset `activityPoints` à 0 via `updateMany`

**Accumulation des points :**

- **Voc** : 1 seconde = 1 point (ajouté dans `StatsService.applyVoiceSegmentsToUser`)
- **Messages** : cooldown 30min en RAM (`Map<userId, timestamp>`), 1 slot valide = 450 points (= 25% du voc à activité égale)

**Rôles (configurables via le dashboard) :**

- Top 3 → Podium
- Top `activeThresholdPercent`% (défaut 10%) → Campeur
- Top `regularThresholdPercent`% (défaut 60%) → Explorateur
- Reste → Void

Les seuils % sont calculés sur `users.length` (tous les users en BDD).

## Économie

**Toute modification touchant à l'argent (`profil.money`), aux récompenses ou aux prix
se lit d'abord dans [`docs/economy.md`](docs/economy.md).** Les règles d'ancrage, la formule du
salaire hebdomadaire et les invariants qui cassent en silence y sont fixés — ils ne
sont pas déductibles du code.

Tout mouvement d'argent passe par `LogService.economy` avec le bon `flow`
(`mint` | `transfer` | `burn`), sinon la page Économie ment.

Le catalogue de la boutique, ses prix et ce qui a déjà été écarté sont dans
[`docs/shop.md`](docs/shop.md) — à lire avant d'ajouter un article.

## Peak Hunters (montagnes)

Dossier `src/features/peak-hunters/` — la feature s'appelait `mountain`, les customId
ont gardé le préfixe `mountain:` (ex: `mountain:home`). Ne pas les renommer sans migration.

### Format des données (`src/features/peak-hunters/data/mountains.json`)

```ts
{
  mountainLabel: string      // nom affiché (première lettre maj)
  elevation: string          // altitude brute en mètres (ex: "8848.86")
  countries: string[]        // ex: ["Népal", "République populaire de Chine"]
  flags: string[]            // ex: ["🇳🇵", "🇨🇳"] — même index que countries
  image: string              // URL Cloudinary (c_fill,w_800,h_450)
  article: string            // URL Wikipedia — sert aussi à dériver l'id
  rarity: MountainRarity     // "common" | "rare" | "epic" | "legendary"
}
```

L'`id` est dérivé du slug Wikipedia dans `loadMountains()` (ex: `Everest`). Ne pas ajouter de champ `id` dans le JSON.

### Seuils de rareté (par altitude)

- `legendary` : ≥ 7000 m
- `epic` : 4250–6999 m
- `rare` : 3000–4249 m
- `common` : < 3000 m

### Helpers MountainService

- `MountainService.getAltitude(m)` → `"8 849 m"`
- `MountainService.getCountryDisplay(m)` → `"🇳🇵 Népal  ·  🇨🇳 République populaire de Chine"`
- Ne jamais accéder à `m.name`, `m.flag`, `m.country`, `m.altitude` — ils n'existent pas.

### Commande `/peak-hunters`

Point d'entrée unique → `executeHome` affiche les stats + 3 boutons (Collection, Packs, Classement).
Chaque bouton embarque le `lastMsgId` dans son customId (`mountain:home:ACTION:LAST_MSG_ID`) pour supprimer le message précédent à chaque navigation.

### Spawn

- Planifié via `MountainSpawnCron` (seul scheduler, `resumeOrPlanToday()` au démarrage)
- Ne pas appeler `MountainSpawnService.rehydrate()` depuis `ready.ts` → double spawn
- Le schedule du jour est persisté en BDD

### Images

- Hébergées sur Cloudinary dans `the-ridge/mountains/{slug}`
- Script d'upload : `scripts/upload-mountains.mjs`

## Système de patchnotes

- Données dans `src/features/admin/data/patchnotes.json` — tableau d'objets, le dernier est envoyé par `/patchnote`
- Structure : `{ version, timestamp, sections: [{ type: "new"|"update"|"fix", blocks: [{ title, items[] }] }] }`
- Commande `/patchnote` (admin) envoie les containers ComponentsV2 dans le channel courant
- **Contenu** : n'inclure que les changements visibles par les utilisateurs — pas de refacto, pas de corrections internes, pas de logs admin

## Conventions

- Pas d'`ephemeral: true` → utiliser `flags: 64` (ou `MessageFlags.Ephemeral`)
- Ownership des interactions : `interaction.message.interactionMetadata?.user.id`
- Toutes les vues utilisent ComponentsV2 (`ContainerBuilder`) — ne pas revenir aux `EmbedBuilder` pour les nouvelles features sauf si l'affichage est préférable
- Pattern navigation avec suppression du message précédent : embarquer le `lastMsgId` dans le customId, `deferUpdate` → delete → `followUp({fetchReply:true})` → `editReply` avec le nouveau msgId

## Style de code

- **Pas de commentaires inutiles** — c'est la règle la plus souvent enfreinte, y compris par les agents. Un commentaire n'est justifié que s'il répond à un *pourquoi* impossible à déduire du code : un contournement d'API, une contrainte externe, un piège non évident. À bannir :
  - le commentaire qui paraphrase la ligne suivante (`// Créer l'embed`, `// Vérifier si...`)
  - la section décorative (`// ===== HELPERS =====`)
  - le commentaire qui justifie un choix de conception — ça va dans le message de commit, la PR ou le README, pas dans le fichier
  - le commentaire signé ou préfixé par un outil / un agent
  - le TODO sans ticket ni date
  Dans le doute : renommer la variable ou extraire une fonction plutôt qu'écrire le commentaire.
- **Code découpé par feature** — chaque feature est autonome dans son dossier. Pas de logique métier qui déborde dans un autre module.
- **Une responsabilité par fichier** — services = logique, repositories = BDD, slash = interaction Discord. Ne pas mélanger.
- **Pas de duplication** — extraire une fonction dès qu'un bloc est utilisé 2 fois.
- **Nommage explicite** — un bon nom de fonction/variable vaut mieux qu'un commentaire.
- **Principes SOLID** — notamment SRP (une seule raison de changer) et DIP (dépendre des abstractions, pas des implémentations concrètes quand ça a du sens).
- **Features indépendantes** — une feature ne doit pas importer directement depuis une autre feature. Si deux features ont besoin de communiquer, passer par un service partagé dans `shared/`, un event Discord, ou un plugin (ex: `VoicePlugin`). Les couplages directs entre features rendent le code fragile et difficile à maintenir.

## grepai

Recherche sémantique par défaut (voir `~/.claude/GREPAI.md`). Requêtes en anglais,
`--json --compact` pour économiser les tokens.

`grepai trace` pour le graphe d'appels — indispensable avant de modifier une fonction
partagée, pour voir tous ses appelants :

```bash
grepai trace callers "applyVoiceSegmentsToUser" --json
grepai trace callees "run" --json
grepai trace graph "ActivityRolesService" --depth 3 --json
```
