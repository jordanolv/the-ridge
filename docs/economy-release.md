# economy-release.md — Finir l'économie et la mettre en prod

Document de travail, à jour au 2026-10-17. Il dit où en est la refonte de l'économie,
ce qui a été décidé et pourquoi, et ce qui reste à trancher avant la mise en prod.
Les règles durables sont dans [`economy.md`](economy.md) et [`shop.md`](shop.md) ; ce
fichier-ci disparaît une fois la prod faite.

---

## 1. Où on en est

`dev` a ~45 commits d'avance sur `main` : paie hebdo, suppression du money/minute,
primes recalées, script de redénomination, boutique, packs, `/me` en onglets.
Rien de tout ça n'est en prod.

- `main` a un commit absent de `dev` (#107, quiz) : la fusion `dev` → `main` a été
  testée, **elle passe sans conflit**.
- Aucune nouvelle variable d'environnement.
- Les invariants de `economy.md` §4 ont été vérifiés dans le code : masse indexée sur
  les qualifiés, seuil 1 800, scores lus avant le reset (`weekly.cron.ts`), paie
  idempotente (index unique sur `weekKey`), montants arrondis, solde de départ 50,
  primes 40 / 25 / 15, daily 0–10.

---

## 2. Ce qui a été décidé

### Prix des packs : 15 / 25 / 45 (au lieu de 150 / 300 / 600)

L'ancienne grille partait d'« une carte = 50 RC », un chiffre qui ne nommait aucun
équivalent réel. Elle avait trois défauts :

1. **Elle cassait l'ancrage** (`economy.md` §1) : 150 € pour trois cartes, c'est la
   même absurdité que la prime de 750.
2. **Elle excluait la moitié du serveur** : le solde médian après redénomination est
   de ~50 RC.
3. **Le Sommet était un piège** : pour 600, quatre Sentiers donnaient autant de
   légendaires et plus de tout le reste.

Nouvelle règle : **une carte = un café ≈ 5 RC**. Un pack plus cher se juge contre le
même budget dépensé en Sentiers ; il doit donner moins de cartes mais plus de haut de
tableau. Simulé sur 450 RC (`scripts/simulate-packs.ts`) :

| 450 RC en… | Communes | Rares | Épiques | Légendaires | Collection complète |
|---|---:|---:|---:|---:|---:|
| 30 Sentiers | 54 | 22,4 | 10,7 | 2,7 | ~12 000 RC |
| 18 Falaises | 50 | **24,3** | **12,2** | 3,0 | ~10 500 RC |
| 10 Sommets | 24 | 11 | 11,3 | **3,7** | ~18 000 RC |

Sentier = volume, Falaise = milieu de tableau, Sommet = chasse aux légendaires.

### La Falaise garde ses communes

La table `falaise` (40 / 35 / 20 / 5) n'est pas touchée : elle sert aussi aux
expéditions gratuites, et le jeu est pensé sur le long terme. C'est le texte qui a
changé — la boutique promettait « Rare ou mieux », elle dit maintenant « de meilleures
chances ». Seul le Sommet garantit une rareté.

Conséquence sur le prix : **à 30, la Falaise repasse sous deux Sentiers**, d'où 25.

### Jeu long terme

Finir les 289 montagnes coûte ~11 000 RC. Un joueur médian qui y met la moitié de sa
paie met près de deux ans ; toute sa paie, un peu moins d'un an. La traîne vient des
18 légendaires à 3 %.

Pour ralentir la complétion, **ne pas monter les prix** (ça recasse l'ancrage et ça
ré-exclut le bas du serveur). Les bons leviers touchent tout le monde pareil :
ajouter des montagnes régulièrement, ou rendre les légendaires plus rares.

### Boutique fermée tant que la redénomination n'a pas tourné

`ShopService.purchase` refuse tout achat tant que le marqueur `redenominate-v1`
n'est pas dans la collection `migrations` (`/shop` répond « ouvre dans quelques
minutes »). Sans ça, entre le déploiement et le script, un solde encore à l'ancienne
échelle achète dix fois trop — le compte le plus riche aurait pu prendre ~1 000 packs.

En local, la boutique est donc fermée tant qu'on n'a pas lancé une fois
`node scripts/redenominate.mjs --apply` sur sa base.

### Patchnote 1.11.0

Écrit dans `src/features/admin/data/patchnotes.json` : monnaie, paie, boutique,
ouverture des packs, `/me`, récompenses, énigme, Peak Hunters, quiz. L'euro n'y est
jamais nommé. **À relire, et mettre le `timestamp` au jour de la prod.**

---

## 3. Ce qui reste à trancher

### Le solde de l'admin — 🔴 avant la migration

Le compte de l'admin est à **161 916**, soit **16 192 RC** après redénomination —
au-dessus du maximum relevé en septembre (~14 000), donc probablement le plus gros
solde du serveur.

| | Valeur |
|---|---:|
| Part de la masse (~80 000 après migration) | ~20 % |
| En semaines de paie médiane (237) | 68 |
| Rapport au p90 (~2 500) | ×6,5 |
| Rapport au solde médian (~50) | ×300 |

Ce que ça casse vraiment :

- **Pas les prix.** La boutique est à prix fixes, il n'y a pas de marché entre
  joueurs : un gros solde ne fait rien monter pour les autres.
- **Le palier prestige** (ci-dessous) : enchère à 10 000 puis +10 %. L'admin le prend
  et personne n'atteint jamais 11 000 pour le reprendre — un puits mort.
- **L'image** : l'admin et dev du bot qui détient un cinquième de la monnaie.

Options :

| Option | Pour | Contre |
|---|---|---|
| **Plafonner son propre compte avant la migration** (au niveau du 2ᵉ solde du serveur) ← recommandé | règle le problème sans toucher à la promesse « ton solde perd un zéro » | un choix personnel à faire |
| Garder le solde | aucune action | exclure le compte des enchères prestige, et assumer l'image |
| Changer la redénomination pour tous (÷ plus fort en haut, impôt) | — | casse la promesse « personne n'y perd », pour tout le serveur. **Écarté.** |

Si plafond : le niveau du 2ᵉ solde se lit sur la page *Économie* du dashboard
(distribution des soldes). L'ajustement passe par la commande admin `/money` avec un
montant négatif : elle le loggue déjà en `burn` (`economy.md` §5). Le faire **avant**
le script, ou après en divisant le plafond par 10.

### Le palier prestige — 🔴 pas bloquant pour la prod

`shop.md` §7 : « Le Sommet » aux enchères permanentes, un seul détenteur, rachat à
+10 %, 50 % rendus à l'ancien détenteur (`transfer`), le reste en `burn`. Restent :

- le **plancher** : 10 000 proposé, à revoir selon la décision sur le solde admin —
  il doit être atteignable par le haut de la distribution, pas par un seul compte ;
- le **pas d'enchère** ;
- le **détenteur à vie** : que se passe-t-il si personne ne rachète pendant des mois
  (décote progressive du prix de rachat ? loyer pour le garder ?).

Ce n'est pas nécessaire pour la mise en prod : le patchnote tient sans lui.

### Emoji perso — 🟡 proposé à 300, pas implémenté

Pas bloquant.

---

## 4. Checklist de mise en prod

Le détail est dans `economy.md` §10. En résumé :

- [ ] Relire et fusionner cette PR dans `dev`
- [ ] Staging : `redenominate.mjs` (simulation puis `--apply`), `/shop` s'ouvre,
      acheter et ouvrir un pack de chaque type, onglet *Paie hebdo*
- [ ] Trancher le solde admin (§3)
- [ ] Mettre le `timestamp` du patchnote 1.11.0 au jour J
- [ ] Prod, avant la fusion : clôturer les bets ouverts et les soirées avec récompense
- [ ] PR `dev` → `main` en **merge commit**, à une heure creuse
- [ ] Aucune partie d'arcade en cours, puis `docker exec <conteneur-bot> node scripts/redenominate.mjs`
      (lire les chiffres : masse ~80 000, médiane ~50) puis `--apply`
- [ ] Dashboard → *Paie hebdo* → **activer** (250 / 40 % / 1 800)
- [ ] `/patchnote` dans le salon des annonces
- [ ] Le lundi suivant : page *Économie*, masse émise ~2 500, pas de double versement
- [ ] Supprimer ce fichier

---

## 5. Refaire les calculs

```bash
node -r @swc-node/register scripts/simulate-packs.ts            # budget 450, 300 runs
node -r @swc-node/register scripts/simulate-packs.ts 1000 500   # autre budget
```

Le script lit les prix dans `catalog.ts`, les tables dans `peak-hunters.constants.ts`
et les montagnes dans `mountains.json` : il suit tout changement de prix, de table ou
de collection. **Le refaire avant de toucher à un prix de pack.**
