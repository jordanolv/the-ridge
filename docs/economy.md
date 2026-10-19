# economy.md — L'économie de The Ridge

Ce document fixe les règles de l'économie du bot. Il existe parce que ces règles se
perdent entre deux sessions et que rien dans le code ne les rend évidentes.

**Avant de toucher à une valeur monétaire, lire ce fichier. Avant de le contredire,
le modifier.**

---

## État d'avancement

Tout est implémenté sur `dev` ; rien n'est encore en production. La mise en prod suit
la procédure du §10.

| | État |
|---|---|
| Champ `flow` sur les logs économie | ✅ implémenté |
| Log du rake des bets (`burn`) | ✅ implémenté |
| Ancrage 1 RC ≈ 1 € | ✅ appliqué aux primes et à la boutique |
| Redénomination ÷10 | 🟡 script prêt, **pas exécuté** |
| Salaire hebdomadaire | ✅ implémenté, **désactivé** par défaut |
| Suppression du money/minute | ✅ implémenté |
| Recalage des primes de jeu | ✅ implémenté |
| Boutique (puits) | ✅ implémentée — voir [`shop.md`](shop.md) |
| Palier prestige | 🔴 à trancher (`shop.md` §7) |

---

## 1. L'ancrage — la règle qui décide de tout

**1 RidgeCoin ≈ 1 euro.**

C'est la règle mère. Elle existe parce que « 750 coins » ne veut rien dire pour un
joueur : sans référentiel, aucun prix n'est lisible et aucun équilibrage n'est
vérifiable.

Conséquence pratique — pour fixer **n'importe quel** prix ou récompense, la question
n'est plus « ça me paraît combien ? » mais :

> Combien ça coûterait / rapporterait dans la vraie vie ?

Ne jamais nommer l'euro publiquement. L'échelle doit être familière sans que la
comparaison soit revendiquée : les joueurs la feront eux-mêmes, et c'est mieux ainsi.

---

## 2. Unité et stockage

**`profil.money` est un entier, en RidgeCoins entiers.** Pas de sous-unité, pas de
centimes.

Le code actuel fait `activeMinutes * 2.5` puis `user.profil.money += moneyGained`, ce
qui produit et accumule des soldes en **flottant**. Cette source disparaît avec le
money/minute (§3) ; partout où un calcul peut produire une fraction — le salaire au
prorata, en premier lieu — le résultat est arrondi avant écriture.

Une sous-unité a été envisagée puis écartée : avec un revenu médian de 210 RC par
semaine, une granularité de 1 RC pèse 0,5 % du revenu hebdomadaire. Elle coûterait un
refactor de tous les sites d'affichage pour un gain nul.

---

## 3. Source unique : le salaire hebdomadaire

**Il n'existe qu'une seule source de création monétaire : la paie du lundi.**

Le paiement du vocal à la minute est **supprimé**. L'XP à la minute est conservée —
ce n'est pas une monnaie, elle n'a pas de problème d'inflation.

### Pourquoi un salaire plutôt qu'un flux continu

Avec un paiement à la minute, l'émission est subie : si le serveur double son
activité, la monnaie créée double. Avec une masse salariale, l'émission est
**décidée**, et une hausse générale d'activité ne crée pas un centime de plus — elle
redistribue les parts.

C'est la seule propriété qui rend une grille de prix valable durablement.

### La formule

```
qualifiés   = users dont activityPoints >= SEUIL_QUALIFICATION
masse       = nb_qualifiés × BUDGET_PAR_ACTIF
smic        = BUDGET_PAR_ACTIF × PART_SMIC
pool_var    = masse − nb_qualifiés × smic

salaire(u)  = smic + (points(u) / total_points) × pool_var
```

### Les paramètres

| Paramètre | Valeur | Rôle |
|---|---:|---|
| `BUDGET_PAR_ACTIF` | 250 RC / semaine | revenu moyen visé par qualifié |
| `PART_SMIC` | 40 % (= 100 RC) | base fixe ; le reste est au prorata |
| `SEUIL_QUALIFICATION` | 1 800 pts | ≈ 30 min de vocal, ou 4 créneaux de messages |

Les points ne changent pas : **1 s de vocal = 1 pt**, **1 créneau de 30 min contenant
au moins un message = 450 pts** (soit 25 % du vocal à durée égale).

### Trois choix de conception à ne pas défaire par accident

**Au prorata, jamais par palier.** Les rôles d'activité sont attribués par rang
(podium / campeur / explorateur / void) et c'est très bien pour des rôles. Un
*salaire* par rang est vicieux : si tout le monde double son activité, personne ne
change de rang et personne n'est mieux payé. Le prorata préserve l'incitation
individuelle.

**Le SMIC compresse l'écart.** Sur les données réelles (13 actifs, semaine du
2026-W38), l'écart de points entre le premier et le dernier qualifié est de 42× et
l'écart de salaire de 4,2×. Baisser `PART_SMIC` étire l'échelle, la monter l'écrase.

Note : la distribution d'activité réelle est bien moins étalée que prévu — 6,4× entre
le premier et le médian, pas 23×. Le SMIC travaille donc surtout pour le bas du
classement (le joueur à 0,8 h touche 109 au lieu de ~20 sans base fixe).

**Le seuil crée une falaise, et c'est voulu.** À 1 799 points on touche 0, à 1 800 on
touche le SMIC. Ne pas le lisser en rampe progressive : un seuil est un objectif
(« il me manque 20 minutes pour être payé ») et il fait revenir les gens en vocal.
Une rampe récompenserait le fait de rester juste en dessous.

### Revenus attendus

Mesurés sur la semaine réelle 2026-W38 (13 actifs, 10 qualifiés) :

| Profil | Vocal / sem | Paie / sem | ≈ / mois | Lecture |
|---|---:|---:|---:|---|
| 1ᵉʳ | 31 h | 459 | 1 987 | un temps plein |
| 3ᵉ | 21 h | 344 | 1 490 | un gros temps partiel |
| Médian | 4,9 h | 237 | 1 030 | — |
| Dernier qualifié | 0,8 h | 109 | 472 | argent de poche |

Masse émise : **2 501 RC/semaine**, soit ~130 000 RC/an — à comparer aux
**795 682 RC déjà en circulation** (§9). L'émission nouvelle est donc marginale
devant le stock existant : c'est la redénomination et la boutique qui traitent le
stock, pas la paie.

**Ce tableau est le garde-fou.** Toute nouvelle source de revenu doit être vérifiée
contre lui : si elle déplace ces valeurs, elle casse la grille de prix.

---

## 4. Invariants — ce qui casse en silence

Ces quatre points ne produisent aucune erreur quand on les viole. Ils produisent une
économie fausse qu'on découvre des semaines plus tard.

**1. La masse salariale s'indexe sur les qualifiés, jamais sur `users.length`.**
Les seuils de rôles, eux, se calculent bien sur toute la base — ne pas copier ce
comportement pour la paie. Un SMIC versé à tous les inscrits est un revenu universel
payé à des comptes morts.

**2. Le seuil de qualification est une protection, pas de l'avarice.**
Il empêche l'exploit suivant : `masse = nb_qualifiés × budget` indexe l'émission sur
un compteur qu'on fait monter au prix d'un seul message. Mesuré — si 200 membres
dormants envoient un message chacun dans la semaine :

| | Qualifiés | Masse émise | Paie du 1ᵉʳ |
|---|---:|---:|---:|
| Normal | 20 | 5 000 RC | 574 |
| 200 dormants × 1 message | 220 | **55 000 RC** | **4 881** |

Émission ×11 à partir de 200 messages. Et les gros joueurs en sont les premiers
bénéficiaires, donc personne n'a intérêt à le signaler. Un `@everyone` auquel 200
personnes répondent « ok » déclenche ça par accident.

**3. `scores` se lit AVANT le reset des `activityPoints`.**
Dans `ActivityRolesService.run()`, un `updateMany` remet `stats.activityPoints` à 0 et
archive la semaine dans `stats.lastWeekActivityPoints`. Le jour où quelqu'un
réorganise cette fonction, la paie verse zéro à tout le monde, sans erreur, et ça se
voit une semaine plus tard.

**4. La paie doit être idempotente.**
Si le bot redémarre au mauvais moment et que le cron repart, tout le monde est payé
deux fois. Il faut un marqueur de semaine déjà versée.

**Découpage** : ne pas mettre le versement dans `ActivityRolesService`. « Attribuer
des rôles » et « payer » sont deux raisons de changer différentes, et le CLAUDE.md
interdit le couplage entre features. Un service `payroll` appelé par le même cron,
avec `scores` en entrée.

---

## 5. Traçabilité — `flow`

Tout mouvement d'argent passe par `LogService.economy(userId, amount, reason, feature, flow)`,
directement ou via `UserService.updateUserMoney(discordId, amount, reason, flow)`.

| `flow` | Sens | Exemples |
|---|---|---|
| `mint` | création monétaire | salaire, primes de jeu, anniversaire, ajustement admin positif |
| `transfer` | joueur → joueur, somme nulle | paris arcade, mises et gains de bets |
| `burn` | destruction | achats en boutique, rake des bets, ajustement admin négatif |

Sans ce champ, la page Économie ment : un pari entre deux joueurs écrit un `-X` et un
`+X`, donc une somme naïve des montants donne ~0 et laisse croire qu'il n'y a pas
d'inflation.

`userId` accepte `null` pour un mouvement sans propriétaire (le rake d'un bet
n'appartient à personne).

---

## 6. Les primes (gains de jeux)

Les gains d'événements — bingo, avalanche, juste-prix, énigme, raids — sont des
**primes hors salaire**, plafonnées à **10–20 % d'une paie hebdomadaire médiane**,
soit **~25 à 50 RC**.

Valeurs appliquées : bingo / avalanche / juste-prix **40**, énigme **40 / 25 / 15**,
raids **20 / 50 / 100** selon la rareté (événement collectif sur plusieurs jours),
daily **0–10**.

Au-delà, elles recréent l'émission incontrôlée que le salaire vient d'éliminer.

Les valeurs précédentes (750 par victoire) étaient hors échelle d'un facteur ~20.
L'ancrage les rendait visiblement absurdes — gagner 750 € en devinant un nombre casse
l'illusion immédiatement. C'est une fonctionnalité du système, pas un problème : il
signale ce qui est mal calibré.

---

## 7. Les puits — sans eux, tout le reste est temporaire

Le salaire contrôle le **débit** d'émission. Il ne détruit rien. Sans puits, la masse
monétaire croît linéairement pour toujours, à un rythme choisi mais jamais nul.

**Loue, ne vends pas.** Un objet permanent est un puits à usage unique : le joueur
riche achète le catalogue en une soirée et il n'y a plus rien à acheter. Un cosmétique
**temporaire (30 jours)** est un puits **récurrent**, qui s'aligne mécaniquement sur
le revenu récurrent.

Revenu hebdomadaire ↔ abonnements mensuels : l'argent entre le lundi et ressort en
loyers. C'est ce qui fait un circuit plutôt qu'un réservoir.

### Grille de prix indicative

Ancrée sur la paie médiane (237 RC / semaine, ~1 030 / mois — §3) :

| Objet | Prix | Équivalent réel |
|---|---:|---|
| Consommable, achat d'impulsion | 2–5 | un café — une carte Peak Hunters |
| Cosmétique 7 jours | 15 | une place de cinéma |
| Rôle coloré 30 jours | 40 | un abonnement |
| Emoji perso, permanent | 300 | — |
| Prestige, permanent, unique | à calibrer | voir §9 |

---

## 8. Redénomination — la migration

Tout est divisé par 10. C'est ce qu'a fait la France en 1960 avec le nouveau franc, et
ça s'explique en une phrase : *« ton solde perd un zéro »*.

**Puis tout solde au-dessus de 5 000 RC est ramené à 5 000.** L'excédent est détruit et
journalisé en `burn` dans `bot_logs`, un log par compte.

```js
updateMany({}, [{ $set: { 'profil.money': { $min: [{ $round: [{ $divide: ['$profil.money', 10] }, 0] }, 5000] } } }])
```

Mesuré sur la prod le 2026-10-17 : 5 comptes sur 91 sont plafonnés (16 418, 15 738,
9 222, 9 120, 7 382 après ÷10), dont celui de l'admin, et 32 880 RC sont détruits. La
masse passe de 93 400 à 60 500 ; la médiane (50) et le p90 (2 835) ne bougent pas.

Pourquoi 5 000 : c'est environ 21 semaines de paie médiane et deux fois le p90, donc
toujours un très gros solde, mais plus un trésor que personne ne peut rattraper. Sans
plafond, deux comptes détenaient chacun ~17 % de la masse, et le palier prestige (§9,
`shop.md` §7) n'aurait eu qu'un acheteur possible. La promesse « personne n'y perd »
reste vraie pour 94 % du serveur ; le patchnote dit franchement ce qui arrive aux autres.

Un solde de 50 000 coins devient 5 000 RC. L'arrondi absorbe au passage les soldes
fractionnaires hérités du money/minute.

Le script est `scripts/redenominate.mjs`. Il tourne en dry-run par défaut, affiche la
masse et les percentiles avant/après, et refuse de s'exécuter deux fois grâce à un
marqueur dans la collection `migrations` :

Il tourne **depuis le conteneur du bot**, qui a déjà `MONGODB_URI` en environnement —
la base n'est pas joignable depuis l'extérieur du réseau Docker :

```bash
docker exec <conteneur-bot> node scripts/redenominate.mjs           # simulation
docker exec <conteneur-bot> node scripts/redenominate.mjs --apply   # execution
```

**`profil.money` n'est pas le seul endroit où dorment des montants.** Le script refuse
de s'exécuter s'il reste des bets ouverts ou verrouillés, ou des soirées non terminées
avec une récompense : réglés après la migration, ils verseraient dix fois trop. Les
paris d'arcade (shifumi, morpion, P4, battle) vivent en mémoire et ne sont pas
détectables — ne pas migrer pendant une partie.

Les prix de la boutique sont déjà à la nouvelle échelle : elle reste **fermée** tant
que le marqueur `redenominate-v1` n'est pas posé, pour qu'aucun solde non migré ne
puisse acheter entre le déploiement et le script.

Les `bot_logs` antérieurs restent en ancienne échelle. La page Économie mélangera les
deux jusqu'à expiration du TTL de 90 jours ; ça ne se corrige pas, ça se sait.

Les constantes, elles, sont déjà recalées dans le code : solde de départ 500 → 50,
anniversaire 100–1000 → 10–100, `baseCoins` des raids 200/500/1000 → 20/50/100.

Le money/minute du vocal a disparu. Le **daily** a été conservé mais ramené de 0–100 à
0–10 : à l'ancienne échelle il versait 148 % d'un salaire hebdomadaire médian, à la
nouvelle il en représente 15 %, ce qui le range dans la bande des primes (§6). C'est un
rituel de feedback quotidien qui ne méritait pas d'être supprimé, seulement calibré.

**Faire la redénomination et l'ouverture de la boutique dans le même patchnote.**
« Nouvelle monnaie + voilà ce que vous pouvez acheter » est une annonce qui se tient ;
« on divise vos soldes par 10 » tout seul n'est qu'une mauvaise nouvelle.

---

## 9. État réel de l'économie — mesuré le 2026-09-18

Relevé en lecture seule sur la base de production (83 comptes).

### Soldes

| | Valeur |
|---|---:|
| Masse en circulation | 795 682 RC |
| Détenteurs | 83 |
| Médiane | **505** |
| Moyenne | 9 587 |
| p90 | 24 888 |
| Maximum | 140 503 |
| Part du décile supérieur | **75,6 %** |

**La médiane vaut le solde de départ.** La moitié du serveur n'a jamais rien gagné
au-delà des 500 RC offerts à l'inscription, pendant que 8 comptes détiennent les
trois quarts de la masse. Le problème n'est pas que l'économie soit inégale : elle
n'existe pas pour la majorité.

### Activité (semaine 2026-W38)

13 comptes avec des points sur 83. Médiane 17 544 pts (4,9 h de vocal), maximum
112 929 (31 h).

| Seuil | Qualifiés |
|---|---:|
| 900 pts (15 min) | 13 |
| **1 800 pts (30 min)** ← retenu | 10 |
| 3 600 pts (1 h) | 9 |

Le seuil de 3 600 initialement prévu écartait 4 actifs réels sur 13. Sur un serveur
de cette taille c'est trop cher payé pour se protéger des comptes dormants : 1 800
bloque toujours le message unique (450 pts) et la visite éclair.

### Texte contre vocal

1,7 message par heure de vocal sur tout l'historique. Le serveur est vocal à une
écrasante majorité — la pondération des messages à 450 pts/créneau ne déplace
pratiquement rien, et la crainte de maltraiter les joueurs textuels ne s'applique
pas ici.

### Ce qu'il reste à trancher

Le seul paramètre encore ouvert est le **prix du palier prestige** de la boutique.
Il doit absorber le solde du plus riche après redénomination, soit 5 000 RC (plafond, §8).

Pour rejouer ces mesures : l'onglet *Paie hebdo* du dashboard simule le calcul sur
les `lastWeekActivityPoints` réels sans rien verser, et la page *Économie* donne la
distribution des soldes.

---

## 10. Mise en production

L'ordre compte : chaque étape suppose la précédente.

**Avant la PR `dev` → `main`**

1. Sur staging : `node scripts/redenominate.mjs` (simulation) puis `--apply`, vérifier
   que `/shop` s'ouvre, acheter et ouvrir un pack, regarder l'onglet *Paie hebdo*.
2. Sur la prod, à l'heure prévue : clôturer ou rembourser les bets ouverts, et
   terminer les soirées avec récompense. Le script refuse de tourner sinon.

**Le jour J, à une heure creuse**

3. Fusionner la PR `dev` → `main` en **merge commit**. Dokploy déploie. `/shop`
   répond « ouvre dans quelques minutes » tant que l'étape 4 n'est pas faite.
4. Pas de partie d'arcade en cours, puis :
   ```bash
   docker exec <conteneur-bot> node scripts/redenominate.mjs           # lire les chiffres
   docker exec <conteneur-bot> node scripts/redenominate.mjs --apply
   ```
   Masse attendue : ~60 500, médiane ~50, max 5 000, 5 comptes plafonnés.
5. Dashboard → *Paie hebdo* : **activer**, paramètres 250 / 40 % / 1 800. Sans ça,
   personne ne gagne plus rien : le money/minute n'existe plus.
6. `/patchnote` dans le salon des annonces. L'euro n'y est jamais nommé (§1).
7. Le lundi suivant : vérifier sur la page *Économie* la masse émise (~2 500) et
   l'absence de double versement.

