# The Ridge — bot Discord

Bot Discord modulaire (TypeScript, discord.js, MongoDB), déployé sur VPS via Dokploy.

## Environnements

Projet Dokploy **The Ridge**, un environnement par déploiement. Chaque environnement
a son application `bot` (build Dockerfile) et son service Mongo `db`.

| Env | Branche | Environnement Dokploy | Déclencheur |
|---|---|---|---|
| Production | `main` | `production` | push sur `main` |
| Staging | `dev` | `staging` | push sur `dev` |

Dokploy écoute les webhooks GitHub et redéploie tout seul : il n'y a pas de workflow
de déploiement dans ce repo, et il ne faut pas en rajouter. Les variables d'env se
gèrent dans l'onglet *Environment* de chaque application, jamais dans le repo.

Les deux environnements ont leur propre bot Discord (token distinct) et leur propre
serveur Discord.

## Flow de travail

```
feat/xxx ──PR──► dev ──PR──► main
                  │            │
               staging        prod
```

1. Brancher depuis `dev` : `git switch dev && git pull && git switch -c feat/xxx`
2. PR vers `dev`. La CI (`npm run build`) doit passer, pas de push direct.
3. Le merge sur `dev` déploie staging. On teste là.
4. Quand c'est bon : PR `dev` → `main` (merge commit, pas de squash — sinon les
   deux branches divergent pour toujours). Le merge déploie la prod.

`main` et `dev` sont protégées : PR obligatoire, CI verte, pas de force-push.

## Commandes

```bash
npm run dev      # lancer en local : bot + Activity (swc, pas de build)
npm run watch    # idem avec rechargement à chaud
npm run build    # tsc + tsc-alias + copie des assets — c'est ce que la CI vérifie
npm start        # node dist/index.js — ce que lance le conteneur
```
