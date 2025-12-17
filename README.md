# 🎮 Pokémon Quiz Battle - Génération 1

Quiz Pokémon local type Kahoot pour 2-4 joueurs sur WiFi.

## 🚀 Spécifications Techniques
- **Backend** : Node.js, Express, Socket.IO
- **Frontend** : HTML5, CSS3, JavaScript Vanilla
- **Données** : PokeAPI (Génération 1 uniquement)
- **Mode** : Local WiFi (multi-appareils)

## 📦 Installation

1. Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé (v18+ recommandé).
2. Installez les dépendances :
   ```bash
   npm install
   ```

## 🎮 Lancement

1. Démarrez le serveur :
   ```bash
   npm start
   ```
2. Le terminal affichera votre adresse IP locale (ex: `192.168.1.15`).
3. **Sur votre TV/Ordinateur principal** : Ouvrez l'URL de l'écran TV.
4. **Sur vos mobiles** : Scannez le QR Code affiché sur la TV ou entrez l'URL des joueurs.
5. Tous les appareils doivent être sur le **même réseau WiFi**.

## 🕹️ Comment jouer ?
1. Chaque joueur choisit un dresseur iconique et un pseudo.
2. Entrez le code à 4 chiffres affiché sur la TV.
3. Une fois au moins 2 dresseurs prêts, l'hôte peut lancer la partie.
4. Répondez le plus vite possible aux 12 questions pour gagner le maximum de points !

## 🛠️ Structure du Projet
- `server/` : Logique backend et gestion du jeu.
- `public/` : Interface utilisateur et ressources statiques.
- `public/trainers/` : Emplacement pour les sprites des dresseurs (64x64px).

## 📝 Crédits
- Données Pokémon : [PokeAPI](https://pokeapi.co/)
- Sprites : Pokémon (Nintendo/Game Freak)
- Police : [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)

---
*Développé pour les fans de Pokémon !*
