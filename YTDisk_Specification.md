# YTDisk Desktop — Cahier des charges

**Version :** 1.0  
**Plateformes :** Windows, Linux, macOS  
**Architecture :** Rust + Tauri 2 + React / TypeScript + shadcn/ui

## 1. Objectif

Transformer le script Python YTDisk existant en application desktop multiplateforme, avec un moteur de traitement en Rust et un gestionnaire de téléchargement intégré.

## 2. Fonctionnalités principales

### Module Encode
- Sélection et glisser-déposer de fichiers.
- Conversion fichier → vidéo YTDISK 4K.
- Chiffrement AES-GCM avec mot de passe facultatif.
- Correction d'erreurs Reed–Solomon.
- Progression du traitement et gestion des erreurs.

### Module Download
- Téléchargement depuis YouTube et Google Drive uniquement.
- Détection automatique du fournisseur à partir de l'URL.
- Affichage de la progression, de la vitesse et de l'état.
- Annulation et reprise lorsque techniquement disponibles.
- Détection automatique des vidéos YTDISK téléchargées.

### Module Decode
- Conversion vidéo YTDISK → fichier original.
- Prise en charge des vidéos historiques générées en Python.
- Déchiffrement avec mot de passe.
- Vérification SHA-256.
- Décodage automatique après téléchargement, si activé.

### Autres fonctionnalités
- Historique des opérations.
- Gestion des tâches et de la file d'attente.
- Paramètres de téléchargement et de stockage.
- Interface claire/sombre.
- Messages d'erreur et notifications.

## 3. Architecture

- **Frontend :** React, TypeScript, shadcn/ui.
- **Desktop Framework :** Tauri 2.
- **Core Engine :** Rust.
- **Video Processing :** FFmpeg.
- **YouTube :** downloader intégré via un composant autonome si nécessaire.
- **Google Drive :** API Google Drive / téléchargements autorisés.
- **Storage :** stockage local des paramètres et de l'historique.

## 4. Compatibilité

L'application doit conserver la capacité de décoder les vidéos produites par l'ancien programme Python, avec les mêmes paramètres de chiffrement, de correction d'erreurs et de format.

## 5. Sécurité et fiabilité

- Validation des URL et des destinations.
- Aucun stockage des mots de passe en clair.
- Vérification systématique des fichiers restaurés.
- Gestion des téléchargements interrompus.
- Aucun succès annoncé si l'intégrité SHA-256 échoue.

## 6. Validation particulière de YouTube

YouTube peut modifier les vidéos après leur mise en ligne. La récupération exacte des fichiers devra être prouvée par des tests réels avant d'être considérée comme fiable. Le téléchargement de contenus doit respecter les autorisations applicables.

## 7. Livrables

- Code source du moteur Rust.
- Application desktop avec interface complète.
- Gestionnaire YouTube et Google Drive.
- Tests unitaires et d'intégration.
- Installateurs Windows, Linux et macOS.
- Documentation technique et utilisateur.
