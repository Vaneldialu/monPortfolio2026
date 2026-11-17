# Portfolio — Vanel Dialundama (Vercel)

Site statique + 4 petites fonctions serveur (`api/`) pour l'espace admin.

## Mise en ligne

1. **Dépôt GitHub** : créez un dépôt et poussez-y tout le contenu de ce dossier.
2. **Jeton GitHub** : GitHub → Settings → Developer settings → Personal access tokens →
   *Fine-grained tokens* → *Generate new token*.
   - Repository access : *Only select repositories* → votre dépôt uniquement
   - Permissions → Repository permissions → **Contents : Read and write**
   - Choisissez une expiration (par ex. 90 jours) et copiez le jeton.
3. **Vercel** : *Add New → Project* → importez le dépôt (aucun réglage de build).
4. **Variables d'environnement** (Settings → Environment Variables, puis *Redeploy*) :

   | Nom | Valeur |
   |---|---|
   | `ADMIN_PASSWORD` | votre mot de passe admin (long et unique) |
   | `SESSION_SECRET` | une longue chaîne aléatoire (32 caractères ou plus) |
   | `GITHUB_TOKEN` | le jeton de l'étape 2 |
   | `GITHUB_REPO` | `votre-compte/nom-du-depot` |
   | `GITHUB_BRANCH` | `main` (facultatif) |

## Utilisation

- Cliquez **3 fois rapidement sur la photo** → écran de connexion → mot de passe.
- Modifiez dans le panneau, puis **Publier** : les changements sont enregistrés en commit
  sur GitHub et Vercel redéploie automatiquement (environ une minute).
- Les photos envoyées sont ajoutées dans `images/`.

## Sécurité

- Le mot de passe n'est jamais dans le code de la page : il est vérifié par `api/login.js`.
- Session par cookie signé `HttpOnly`, `Secure`, `SameSite=Strict`, valable 8 h.
- `api/save.js` refuse toute requête sans session valide ou venant d'un autre site.
- Le jeton GitHub reste côté serveur et ne doit avoir accès qu'à ce dépôt.
- Limitation des essais : 5 erreurs → blocage 15 min (par instance serveur). Pour plus de
  fermeté, activez le *Rate Limiting* du pare-feu Vercel sur `/api/login`.
