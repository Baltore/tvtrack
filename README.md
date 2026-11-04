# TVTrack

TVTrack est une application web de suivi d'animés : recherche, bibliothèque personnelle, progression **saison par saison et épisode par épisode**, notes, favoris, sorties à venir et import depuis TV Time. Interface sombre moderne, responsive mobile / tablette / desktop.

## Fonctionnalités

- Création de compte et connexion (JWT)
- Dashboard : temps passé devant des animés (mois/jours/heures), épisodes vus, statistiques, "Continuer à regarder", sorties des 7 prochains jours
- **Calendrier des sorties** : les prochains épisodes des animés **de ta liste**, groupés par jour (Hier, Aujourd'hui, puis les jours de la semaine jusqu'à J+6, puis « Plus tard » avec le décompte de jours)
- Recherche AniList avec debounce + catalogue sans recherche (tendances, populaires cette saison, populaires de tous les temps, mieux notés)
- **Saisons regroupées** : les saisons d'une même série (entrées AniList séparées) sont fusionnées en une seule fiche — Mushoku Tensei = 1 carte avec 5 saisons, pas 6 résultats
- Fiche détail : liste des saisons (progression, coche "saison vue", grille d'épisodes dépliable — cliquer sur l'épisode N marque tout ce qui précède comme vu)
- Suivi par animé : statut (à voir, en cours, terminé, en pause, abandonné — mis à jour automatiquement selon la progression), note sur 10, favori, commentaire personnel
- Bibliothèque avec filtres (statut, favoris, note minimum, titre) et tri (récent, activité, note, titre, progression)
- **Import TV Time** : charge le fichier JSON de ton export TV Time, l'app retrouve tes animés sur AniList et importe ta progression
- Toasts, skeleton loaders, états vides avec actions

## Stack

- Backend : Node.js, Express, MongoDB, Mongoose, JWT
- Frontend : React + Vite (sans autre dépendance)
- API externe : AniList GraphQL (pas de clé requise)


