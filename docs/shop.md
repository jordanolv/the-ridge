# shop.md — La boutique de The Ridge

Ce document fixe ce qui se vend, à quel prix, et surtout **ce qui ne se vend pas**.
Il est le pendant de [`economy.md`](economy.md) : l'économie décide du débit d'argent
qui entre, la boutique décide de celui qui sort.

**Avant d'ajouter un article, lire ce fichier. Avant de le contredire, le modifier.**

---

## État d'avancement

| | État |
|---|---|
| Commande `/shop` — catalogue, achat, expiration | ✅ implémenté |
| Achat multiple (1 à 6 mois / unités) | ✅ implémenté |
| Rôle coloré (6 couleurs) | ✅ vendable |
| Packs Peak Hunters | ✅ achetables, stockés en inventaire |
| Design de carte `/me` | 🟡 câblé, en attente des images de fond |
| Ouverture animée des packs | ✅ un pack à la fois, carte par carte (§5) |
| Palier prestige | 🔴 à trancher (§7) |

---

## 1. Pourquoi la boutique existe

Elle n'existe pas pour donner des trucs cools aux joueurs. Elle existe parce que
`economy.md` §7 est sans issue : le salaire contrôle le débit d'émission mais ne
détruit rien. Sans puits, la masse croît pour toujours et toute grille de prix finit
fausse.

Conséquence : **la question n'est jamais « est-ce que ça ferait plaisir ? » mais
« combien ça brûle, et est-ce que ça brûle encore le mois prochain ? »**

Un article qui ne brûle qu'une fois par joueur n'est pas un puits, c'est un délai.

---

## 2. Les trois règles

**1. Loue, ne vends pas.** Un cosmétique à 30 jours s'aligne sur un revenu
hebdomadaire et devient un loyer récurrent. Un objet permanent est acheté une fois et
le joueur riche vide le catalogue en une soirée. Les exceptions permanentes doivent
se justifier par une rareté externe (§4, emoji perso) ou par un mécanisme de rachat
(§7).

**2. Rien qui rapporte.** Aucun article ne donne d'argent, d'activityPoints, de
salaire ou d'avantage sur la paie. Un article qui produit de l'argent transforme la
boutique — le puits — en source, et annule tout `economy.md`. L'**XP** et les
**cosmétiques** sont hors de ce périmètre : l'XP n'est pas une monnaie
(`economy.md` §3), un cadre de carte ne rapporte rien.

Cas limite assumé : les **packs** (§4) accélèrent la collection Peak Hunters, qui
s'obtient sinon en vocal. C'est accepté parce que la collection n'a aucun pouvoir —
elle ne produit ni argent ni points, seulement du statut.

**3. Tout achat est un `burn`.** `LogService.economy(userId, -prix, raison, 'shop', 'burn')`.
Sans ça la page Économie compte l'achat comme une circulation neutre et l'inflation
affichée ment (`economy.md` §5).

---

## 3. Fixer un prix

L'ancrage de `economy.md` §1 s'applique : **1 RC ≈ 1 €**. Un prix se justifie en
nommant son équivalent réel, jamais au feeling.

Référence de revenu : **paie médiane 237 RC / semaine**, soit ~1 030 / mois.

| Bande | Prix | Ce que c'est |
|---|---:|---|
| Impulsion | 2–5 | un café |
| Petit plaisir | 15–40 | une place de cinéma, un abonnement |
| Achat réfléchi | 75–150 | une sortie, un jeu |
| Gros achat | 200–600 | un objet qu'on économise une ou deux semaines |
| Prestige | 10 000+ | hors échelle, réservé au haut de la distribution |

---

## 4. Catalogue v1

| Article | Prix | Durée | Statut |
|---|---:|---|---|
| Rôle coloré | 40 | 30 j | ✅ validé |
| Pack Sentier — 3 cartes | 150 | consommable | ✅ validé |
| Pack Falaise — 5 cartes | 300 | consommable | ✅ validé |
| Pack Sommet — 5 cartes | 600 | consommable | ✅ validé |
| Design de carte `/me` | 50 | 30 j | ✅ validé |
| Emoji perso | 300 | permanent | 🟡 proposé |
| Le Sommet | 10 000+ | permanent, unique | 🟡 proposé (§7) |

### Les packs

Une **expédition** (gagnée en vocal) donne une carte. Un **pack** (acheté) en donne
plusieurs, dont une garantie. C'est ce qui les distingue : la boutique ne vend pas la
même chose en plus cher, elle vend l'ouverture.

| Pack | Cartes | Table des N−1 premières | Table de la dernière | Prix |
|---|---:|---|---|---:|
| Sentier | 3 | `sentier` | `sentier` | 150 |
| Falaise | 5 | `sentier` | `falaise` — ≥ Rare en pratique | 300 |
| Sommet | 5 | `sentier` | `sommet` — Épique ou Légendaire garantie | 600 |

**Aucune nouvelle table de probabilités.** `EXPEDITION_TIER_RARITY_WEIGHTS` existe
déjà avec ses trois entrées ; elles cessent d'être des « niveaux d'expédition » pour
devenir des **qualités de slot**. La table `sommet` (0 % commune, 10 % rare, 65 %
épique, 25 % légendaire) garantit déjà par construction l'Épique ou mieux — c'est
littéralement sa description dans `EXPEDITION_TIER_CONFIG`.

Structure volée aux boosters Pokémon, et pour la même raison : des cartes banales qui
défilent, **une carte du fond qui décide de tout**. Sans slot garanti, un pack à
5 cartes communes est cinq déceptions au lieu d'une.

### Comment les prix sont fixés

Unité de compte : **une carte au tirage normal = 50 RC**. Le supplément d'un slot
garanti est son coût de rareté — un Épique sort à 12 % au tirage normal, donc il vaut
environ 8 cartes.

```
Sentier  = 3 × 50                        = 150
Falaise  = 4 × 50 + slot Rare (100)      = 300
Sommet   = 4 × 50 + slot Épique (400)    = 600
```

Le Sentier à 150 est l'entrée de gamme délibérée : **les deux tiers d'une paie
médiane**, donc un achat réel pour un joueur moyen et pas seulement pour les huit
comptes qui tiennent 75 % de la masse.

Repère de contrôle : une expédition gratuite coûte 20 fragments, soit 5 h de vocal.
Un pack Sentier à 150 vaut donc 15 h de vocal achetées en une commande. **La boutique
est un raccourci cher, pas un remplacement du vocal** — si ce rapport s'inverse, les
fragments n'ont plus de raison d'exister.

### Pas de prix progressif, pas de limite

Envisagé pour empêcher un gros solde d'acheter cinquante packs d'un coup, puis écarté :
un joueur qui brûle 14 000 RC en packs est le meilleur scénario possible pour la masse
monétaire. Son seul coût est qu'il termine sa collection plus vite — et les doublons
continuent de rendre des fragments (`fragmentsOnDuplicate`), donc un pack garde une
valeur après complétion.

Avec 289 montagnes en base (144 communes, 83 rares, 44 épiques, 18 légendaires), la
collection tient largement le rythme. Si elle devient triviale à finir, la réponse est
**d'ajouter des montagnes**, pas de rationner la boutique.

### Le design de carte `/me`

`/me` répond **en public**. C'est la seule surface où un joueur se met vraiment en
scène devant le salon, donc la seule qui justifie un cosmétique payant.

La carte est mise en page par [Satori](https://github.com/vercel/satori) (flexbox → SVG)
puis rastérisée par resvg, dans `src/features/user/services/profile-card/`. Les cadres
sont fixes (`geometry.ts`), leur contenu se place tout seul : un pseudo long rétrécit
puis se coupe, les rôles passent à la ligne, rien n'est positionné à la main.

**Un thème est une image de fond.** Tout `.png`/`.jpg`/`.webp`/`.svg` déposé dans
`assets/cards/` devient un design achetable au redémarrage, l'id venant du nom du
fichier. Les panneaux en verre dépoli, textes, icônes et logo sont posés par-dessus :
l'image doit être **sans texte**, en 16:9 (1500×900 idéalement, sinon recadrée au centre).
Un `<id>.json` facultatif règle le libellé et les couleurs :

```json
{ "label": "Crépuscule", "panelColor": "#2b1d3a", "panelOpacity": 0.5, "blur": 14, "accent": "#f5a623" }
```

`classique` est le thème gratuit par défaut et doit exister. Pour juger un thème sans
lancer le bot :

```bash
node -r @swc-node/register scripts/preview-card.ts <id> [pseudo]
```

Le design acheté est stocké dans `profil.cardTheme` — pas lu depuis les locations de
la boutique. `/me` n'a donc rien à savoir de la boutique, et un thème dont le fichier
a disparu retombe silencieusement sur le classique au lieu de casser la commande.

Une idée de bannière libre uploadée par le joueur a été écartée : une image arbitraire
sur une carte publique demande une file de modération, c'est-à-dire une feature, pas
un article.

---

## 5. L'ouverture des packs

Aujourd'hui l'ouverture d'une expédition est instantanée : un `editReply` et la
montagne est là. Tout le plaisir d'un pack est dans les secondes d'avant.

Un pack s'ouvre **carte par carte, au clic**, jamais d'un bloc :

| Étape | Affichage | Durée |
|---|---|---|
| Achat | le pack entre en inventaire, bouton **Ouvrir** | — |
| Cartes 1 → N−1 | carte nette, barre `▮▮▯▯▯`, tableau de chasse `⬜×2 🟦×1`, bouton **Suivante** | au clic |
| Carte N | WebP animé : flou qui se lève, reflet, nom en fondu | 2,8 s auto |
| Bilan | les N cartes, nouvelles obtenues, progression `87/289`, fragments rendus | — |

Le clic fait le rythme mieux qu'un timer : le joueur décide quand il retourne la
carte suivante, et la dernière — la seule qui compte — est la seule à mériter une
animation. La barre d'accent prend la couleur de rareté avant que le nom soit lisible.

L'animation est un **WebP animé de 480×270**, rendu par `@napi-rs/canvas` et encodé
par `ffmpeg-static` — les deux étaient déjà dans les dépendances, rien à installer.
Elle est **générée une seule fois par montagne** puis servie par Cloudinary
(`the-ridge/mountains/reveal/{slug}`), donc ~1,4 s pour le premier joueur qui la sort
et zéro pour tous les suivants. La génération est lancée **au premier clic**, pendant
que le joueur retourne les cartes 1 → N−1 : elle est prête quand il arrive à la
dernière. Au-delà de 6 s d'attente ou en cas d'échec, on retombe sur la révélation
par éditions de message — une animation ratée ne doit jamais coûter la carte.

`scripts/pregenerate-reveals.ts` génère les 289 d'avance si on ne veut aucun joueur
qui attende. Le WebP a été préféré au GIF : 6× plus léger (120 Ko contre 700) et sans
banding sur les dégradés de ciel, animation vérifiée sur desktop et mobile.

Contraintes :

- **Un pack acheté est un objet d'inventaire** (`sentierPacks`, `falaisePacks`,
  `sommetPacks` sur `user_mountains`), pas une ouverture en attente. Il se retrouve
  dans `/peak-hunters` → Packs et s'ouvre quand le joueur veut — un achat non ouvert
  ne se perd jamais.
- **Les cartes sont tirées et débloquées au premier clic**, pas à l'achat. Le pack est
  décrémenté par un update conditionnel (`{ $gte: 1 }`), donc deux clics simultanés ne
  peuvent pas ouvrir le même pack. Si le bot tombe pendant l'animation, les cartes sont
  déjà dans la collection ; seules les frames restantes sont perdues.
- **Un pack à la fois, toujours avec l'animation.** Acheter 4 packs ne donne pas un
  bilan groupé : c'est quatre ouvertures. Le bilan propose directement d'ouvrir le
  suivant. Un bilan groupé supprimerait le seul moment qui justifie le prix.

---

## 6. Ce qui a été écarté, et pourquoi

Ne pas les reproposer sans argument nouveau.

| Article | Raison du rejet |
|---|---|
| Pseudo custom | Les membres peuvent déjà changer leur pseudo eux-mêmes. |
| Bureau / vocal privé | Fragmente un serveur dont toute la valeur est d'être en vocal ensemble. |
| Rôle de groupe mentionnable | Aucune demande, complexité de permissions pour rien. |
| Titre sous le pseudo | Affiché dans `/profil`, où personne ne va. Invisible = sans valeur. |
| Accent color perso | Le container n'est rendu que pour son propre auteur : le joueur serait seul à voir ce qu'il a payé. |
| Boost d'argent / de points | Viole la règle 2 (§2). |

---

## 7. Le palier prestige — non tranché

`economy.md` §9 : 8 comptes détiennent 75 % de la masse, le plus riche ~14 000 RC
après redénomination. Aucun loyer à 40 RC n'absorbe ça.

Piste actuelle — **Le Sommet, aux enchères permanentes** :

> Un seul détenteur sur le serveur. Rôle en haut de la liste, couleur unique.
> N'importe qui peut le racheter en payant **+10 %** du dernier prix. L'ancien
> détenteur récupère 50 % (`transfer`), le reste part en `burn`.

C'est le seul objet permanent qui reste un puits récurrent : il brûle à chaque
passage de main et il ne vise que le haut de la distribution. Prix plancher proposé :
10 000.

Reste à trancher : le plancher, le pas d'enchère, et ce qui se passe si personne ne
rachète pendant des mois (un détenteur à vie est un puits mort).

---

## 8. Implémentation — le minimum

`src/features/shop/` — le catalogue est de la donnée (`catalog.ts`), pas du code.

```
catalog.ts                    articles, prix, variantes
models/shop-rental.model.ts   une ligne par (userId, itemId) en cours
services/shop.service.ts      achat : débit, livraison, log burn
services/color-role.service.ts
services/shop-ui.service.ts   containers ComponentsV2
cron/shop-expiry.cron.ts      révocation, toutes les heures
```

**Une ligne de location par article, pas par variante.** Racheter une autre couleur
remplace la précédente et cumule le temps restant — le joueur ne peut pas se
retrouver avec deux rôles colorés dont un seul est visible.

Les consommables (packs) n'ont pas de ligne : ils créditent et disparaissent.

L'affichage est une liste de cartes : une `SectionBuilder` par article, **le prix
dans le bouton** en accessoire (`40 💰`, jamais un « Voir » neutre — on sait ce qu'on
paie avant de cliquer). Les variantes passent par un select avec pastille colorée,
pas par une rangée de boutons : ça tient jusqu'à 25 entrées et affiche la sélection
courante en placeholder.

Discord n'a pas de grille — seul `MediaGalleryBuilder` tuile, et uniquement des
images non cliquables. Une grille dessinée au canvas a été envisagée puis écartée :
trop cher pour cinq articles.

La quantité (`−` / `+`, plafond 6) multiplie le prix **et** la durée : 3 mois de rôle
coloré = 120 RC. Tout l'état de navigation tient dans le `customId`
(`shop:view:<article>:<variante>:<quantité>`), donc aucune session à stocker.

Trois points qui ne se devinent pas :

- **Le débit est conditionnel** (`'profil.money': { $gte: prix }` dans le filtre du
  `updateOne`), pas un `read` puis un `$inc`. Deux clics simultanés sur *Acheter* ne
  peuvent pas passer tous les deux.
- **Livraison ratée = remboursement**, et rien n'est écrit dans le journal économie :
  un achat annulé ne doit laisser aucune trace de `burn`.
- **Le `burn` est loggué après la livraison**, jamais avant.

Ajouter un article = une entrée dans `catalog.ts`, plus un `case` dans `grant` et
`revokeItem` s'il faut livrer quelque chose. Si un article demande sa propre
plomberie, c'est un signe qu'il ne rentre pas dans la boutique.

Pas de vitrine, pas de stock tournant, pas de remises tant que le catalogue tient sur
une page.
