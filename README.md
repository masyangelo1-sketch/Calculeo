# Stock magasin

Application hors ligne pour suivre les **entrées** et **sorties** de marchandises par **référence**.
Stock actuel = stock de départ + total des entrées − total des sorties.

## Fonctions
- Saisie rapide d’une entrée ou d’une sortie, avec aperçu du stock avant et après.
- Alerte si une sortie rend le stock négatif.
- Stock par référence : entrées, sorties, stock actuel, alerte de seuil minimum.
- Historique filtrable par référence et par type, avec suppression d’un mouvement.
- Export CSV (stock, mouvements) lisible dans Excel, sauvegarde et restauration JSON.
- Fonctionne sans connexion une fois chargée une première fois, installable sur le téléphone.

## Publier sur GitHub Pages
```bash
git init
git add .
git commit -m "Application stock magasin"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/stock-magasin.git
git push -u origin main
```
Sur GitHub : **Settings → Pages → Source : Deploy from a branch → main / (root)**.
L’adresse sera `https://VOTRE-COMPTE.github.io/stock-magasin/`.

## Installer sur le téléphone
Ouvrir l’adresse une première fois avec internet, puis :
- Android (Chrome) : menu ⋮ → **Installer l’application**
- iPhone (Safari) : Partager → **Sur l’écran d’accueil**

## Mettre à jour
Après toute modification, changer le numéro de version dans `sw.js` (`stock-magasin-v2`, etc.)
pour que les appareils rechargent les nouveaux fichiers.

## Données
Elles sont stockées sur l’appareil (localStorage). Chaque téléphone a ses propres données :
utilisez **Sauvegarder (JSON)** régulièrement, et **Restaurer** pour les transférer.
