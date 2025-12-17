# CHANGELOG - Pokémon Quiz Battle

## Version 2.0.0 - Spécial Cousquer (Mise à jour majeure)

### 🌍 Localisation & Langue
- **FRANÇAIS INTÉGRAL** : Toutes les questions, types, et interface sont maintenant en français.
- Utilisation de l'API PokeAPI pour récupérer les noms officiels français (Dracaufeu, Tortank, etc.).
- Traduction manuelle des 18 types et des éléments d'interface.

### 🎮 Nouveaux Modes de Jeu
- **Menu de Sélection** : L'hôte peut maintenant choisir le mode de jeu avant de commencer.
- **Mode CLASSIQUE** : Quiz QCM traditionnel (12 questions).
- **Mode ORTHOGRAPHE** : Les joueurs doivent saisir le nom du Pokémon au clavier.
  - Validation intelligente avec tolérance aux fautes de frappe (Algorithme de Levenshtein).
  - Input dédié sur mobile.

### 📱 Interface Joueur (Mobile)
- **Formes Géométriques** : Remplacement des boutons textuels par des formes SVG (Cercle, Carré, Rectangle, Étoile) pour une meilleure lisibilité et rapidité.
- **Mode Saisie** : Apparition automatique d'un champ texte pour le mode Orthographe.
- **Responsive** : Amélioration de l'affichage sur tous les appareils.

### 📺 Interface Hôte (TV)
- **Classement Visuel** : Nouveau design avec barres de progression colorées et avatars.
- **Joueur le plus rapide** : Affichage d'un éclair jaune avec le nom du joueur le plus rapide après chaque question.
- **Affichage des Formes** : Les réponses affichent désormais les icônes géométriques correspondantes.

### ⚙️ Technique
- Optimisation du chargement des données Pokémon (batch fetching).
- Refonte du GameManager pour supporter plusieurs types d'inputs (Index vs Texte).
- Calcul du temps de réponse précis côté serveur.
