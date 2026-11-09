# YTDisk Desktop (v1.0)

> High-Density Optical Storage Engine inside 4K YouTube & Google Drive Videos.  
> Built with **Rust + Tauri 2 + React + TypeScript + shadcn/ui**.

---

## 1. Vue d'ensemble

**YTDisk Desktop** transforme n'importe quel fichier numérique (documents, archives, exécutables, données chiffrées) en une vidéo haute fidélité 4K (3840×2160) codée en noir et blanc, avec correction d'erreur Reed–Solomon et chiffrement optionnel AES-256-GCM.

L'application intègre également un gestionnaire de téléchargement dédié à **YouTube** et **Google Drive**, capable d'extraire automatiquement et de restaurer les fichiers avec une vérification cryptographique systématique SHA-256.

Elle conserve une **compatibilité bidirectionnelle stricte à 100% avec l'ancien script Python** : une vidéo générée par le script Python peut être décodée par l'application Rust/Tauri, et inversement.

---

## 2. Architecture

```
ytdisk/
├── YTDisk_Specification.md   # Cahier des charges
├── main.py                   # Script historique de référence Python
├── requirements.txt          # Dépendances Python
├── package.json              # Frontend React / TypeScript / Vite / Tailwind
├── tailwind.config.js        # Configuration Tailwind CSS & shadcn/ui
├── src/                      # Interface utilisateur Desktop
│   ├── App.tsx               # Point d'entrée principal & gestionnaire d'onglets
│   ├── components/           # Composants d'interface (Encode, Download, Decode, Queue, History, Settings)
│   ├── components/ui/        # Composants visuels shadcn/ui (Button, Card, Input, Progress, Switch, Badge)
│   ├── types/                # Types TypeScript
│   └── lib/utils.ts          # Formatage d'octets, débits, classes CSS
└── src-tauri/                # Moteur Core en Rust & bindings Tauri 2
    ├── Cargo.toml            # Dépendances Rust (reed-solomon, aes-gcm, scrypt, tokio, reqwest, etc.)
    ├── tauri.conf.json       # Configuration Tauri 2 & cibles de build (Linux, Windows, macOS)
    ├── src/
    │   ├── lib.rs            # Point d'entrée de la librairie Tauri
    │   ├── main.rs           # Binaire de l'application desktop GUI
    │   ├── commands.rs       # Commandes IPC Tauri exposées au frontend
    │   ├── engine/           # Moteur optique et cryptographique
    │   │   ├── config.rs     # Constantes (1920x1080, 4K, 30 FPS, BLOCK=4, NSYM=32, etc.)
    │   │   ├── crypto.rs     # Chiffrement AES-256-GCM & dérivation Scrypt (N=32768, r=8, p=1)
    │   │   ├── ecc.rs        # Reed-Solomon avec entrelacement par transposition matricielle
    │   │   ├── frame.rs      # Échantillonnage de blocs et conversion bits <-> trames vidéo
    │   │   ├── header.rs     # En-tête conteneur JSON + ECC 64 symboles
    │   │   ├── encoder.rs    # Pipeline d'encodage vidéo FFmpeg avec streaming
    │   │   └── decoder.rs    # Pipeline de décodage vidéo FFmpeg avec vérification SHA-256
    │   ├── downloader/       # Gestionnaire de téléchargement YouTube & Google Drive
    │   │   ├── detector.rs   # Détection automatique de fournisseur d'URL
    │   │   ├── gdrive.rs     # Téléchargement HTTP direct avec reprise (Range) et cookies
    │   │   └── youtube.rs    # Téléchargeur YouTube via yt-dlp avec suivi temps réel
    │   ├── tasks/            # Gestionnaire de tâches d'arrière-plan, file d'attente et historique
    │   └── bin/
    │       └── cli.rs        # Binaire autonome en ligne de commande (`ytdisk-cli`)
    └── tests/
        └── integration_tests.rs # Tests d'intégration de bout en bout
```

---

## 3. Spécifications techniques et algorithmes

### 3.1. Encodage vidéo et trames
- **Résolution native :** 1920×1080, agrandie en 3840×2160 (4K UHD) par interpolation au plus proche voisin (`scale=3840:2160:flags=neighbor`). Cela garantit que YouTube applique ses profils d'encodage VP9 / AV1 haute qualité sans dégrader les pixels.
- **Blocs :** Par défaut `block = 4` (grille de 480×270 cellules par trame = 129 600 bits par trame).
- **Échantillonnage :** Lors de la lecture, une marge de $m = \lfloor block / 4 \rfloor$ pixels est exclue sur les bords pour éviter le bruit de compression des contours, et la moyenne de la zone centrale est comparée au seuil 127.

### 3.2. Correction d'erreur Reed–Solomon
- **Corps fini :** $GF(2^8)$, polynôme primitif `0x11d` ($x^8 + x^4 + x^3 + x^2 + 1$), racine primitive $\alpha = 2$, première racine consécutive `fcr = 0`.
- **Paramètres :** Longueur de mot de code $N = 255$, symboles de contrôle par défaut $nsym = 32$ (capacité de corriger jusqu'à 16 octets erronés par mot de code de 255 octets).
- **Entrelacement temporel :** La matrice des mots de code est transposée (`codewords.T`) avant d'être écrite sous forme de trames vidéo. Ainsi, un macrobloc vidéo corrompu par la compression ne touche que quelques octets de chaque mot de code plutôt que de détruire un mot de code complet.

### 3.3. Chiffrement AES-GCM
- **Dérivation de clé :** Scrypt avec sel cryptographique de 16 octets aléatoires, $N = 2^{15} = 32768$, $r = 8$, $p = 1$, clé dérivée de 32 octets (256 bits).
- **Chiffrement authentifié :** AES-256-GCM avec nonce de 12 octets et tag d'authentification de 16 octets.
- **Zéro stockage :** Aucun mot de passe n'est stocké en clair, ni en base de données, ni dans les fichiers de configuration ou d'historique.

### 3.4. En-tête conteneur
- 30 trames d'en-tête (1 seconde à 30 FPS) écrites au début de la vidéo.
- `HEADER_BLOCK = 16`, `HEADER_NSYM = 64`.
- Encodage JSON de la métadonnée (`magic`, `v`, `name`, `size`, `sha256`, `payload_len`, `codewords`, `block`, `nsym`, `frames`, `encrypted`), préfixé de la taille sur 2 octets en grand-boutien.

---

## 4. Fonctionnalités de l'interface Desktop

1. **Module Encode :**
   - Sélection de fichier par glisser-déposer ou explorateur natif.
   - Choix du bloc (4x4, 8x8, 16x16) et du niveau de parité Reed-Solomon (16, 32, 64).
   - Calculateur de capacité et de débit en temps réel (KB/trame, KB/s, durée pour 1 Go).
   - Chiffrement optionnel par mot de passe avec indicateur visuel.
   - Jauge de progression animée avec débit FPS en direct.
   - Affichage du hash SHA-256 vérifié avec copie en un clic.

2. **Module Download :**
   - Téléchargement exclusif depuis YouTube et Google Drive.
   - Détection automatique du service à la saisie de l'URL.
   - Progression en direct : pourcentage, vitesse (Mo/s), octets transférés et temps restant estimé (ETA).
   - Possibilité d'annulation immédiate.
   - Détection automatique si le fichier téléchargé est un conteneur YTDisk.
   - Décodage automatique en chaîne si activé dans les paramètres.

3. **Module Decode :**
   - Inspection préalable de l'en-tête sans décoder la vidéo entière.
   - Déchiffrement AES-256-GCM automatique sur saisie du mot de passe.
   - **Vérification systématique d'intégrité SHA-256** : bannière verte de validation ou alerte rouge de corruption.
   - Rapport des octets réparés par Reed-Solomon.

4. **File d'attente (Queue) :**
   - Suivi centralisé des encodages, téléchargements et décodages simultanés.
   - Bouton d'annulation par tâche.

5. **Historique :**
   - Journal persistant des opérations dans `~/.config/ytdisk/history.json`.
   - Filtres par type (Encode, Download, Decode), recherche textuelle et nettoyage.

6. **Paramètres :**
   - Diagnostic automatique de la présence de FFmpeg et yt-dlp avec chemins détectés.
   - Configuration des dossiers par défaut (Vidéos, Téléchargements, Fichiers restaurés).
   - Bascule du thème Clair / Sombre.

---

## 5. Utilisation de la CLI autonome (`ytdisk-cli`)

Le moteur Rust fournit également un binaire autonome en ligne de commande :

```bash
# Compiler le CLI
cd src-tauri
cargo build --bin ytdisk-cli --release

# Afficher l'aide
./target/release/ytdisk-cli --help

# 1. Calculer la capacité
./target/release/ytdisk-cli capacity --block 4 --nsym 32

# 2. Encoder un fichier en vidéo 4K
./target/release/ytdisk-cli encode mon_archive.zip -o upload.mp4 --password "MonMotDePasse123"

# 3. Inspecter une vidéo sans la décoder
./target/release/ytdisk-cli inspect upload.mp4

# 4. Décoder une vidéo vers un dossier de destination
./target/release/ytdisk-cli decode upload.mp4 -o ./restored/ --password "MonMotDePasse123"

# 5. Télécharger depuis YouTube ou Google Drive avec auto-décodage
./target/release/ytdisk-cli download "https://www.youtube.com/watch?v=XXXXX" -o ./downloads/ --auto-decode
```

---

## 6. Tests et Validation

### Tests unitaires Rust :
```bash
cd src-tauri
cargo test
```
Résultats : 9 tests unitaires validés (frames, encodage Reed-Solomon, détection de fournisseur, chiffrement AES-GCM, en-têtes).

### Tests d'intégration :
```bash
cargo test --test integration_tests
```
Résultats : tests de bout en bout avec encodage FFmpeg, décodage, validation SHA-256, rejet de mot de passe incorrect.

### Test de compatibilité croisée Python <-> Rust :
```bash
# 1. Encodage avec le script Python historique
python3 main.py encode document.pdf -o test_py.mp4 --password "TestPass"

# 2. Décodage avec le moteur Rust
./target/debug/ytdisk-cli decode test_py.mp4 -o restored_by_rust --password "TestPass"
diff -s document.pdf restored_by_rust/document.pdf
# Résultat : IDENTICAL, byte for byte!

# 3. Encodage avec le moteur Rust
./target/debug/ytdisk-cli encode document.pdf -o test_rust.mp4 --password "TestPass"

# 4. Décodage avec le script Python historique
python3 main.py decode test_rust.mp4 -o restored_by_py --password "TestPass"
diff -s document.pdf restored_by_py/document.pdf
# Résultat : IDENTICAL, byte for byte!
```

---

## 7. Compilation et Création des Installateurs

### Prérequis système
- **Linux :** `ffmpeg`, `webkit2gtk-4.1` (ou `webkit2gtk`), `pkg-config`, `libssl-dev`
- **Windows :** `ffmpeg` dans le PATH, WebView2 runtime (inclus dans Windows 10/11)
- **macOS :** `ffmpeg` via Homebrew (`brew install ffmpeg`)
- **Node.js :** v18+ et Rust stable

### Lancement en mode développement
```bash
npm install
npm run tauri dev
```

### Génération des installateurs de production
```bash
# Construire le frontend et l'application Tauri
npm run build
npm run tauri build
```
Les installateurs générés se trouvent dans `src-tauri/target/release/bundle/` :
- **Linux :** paquet `.deb` et exécutable autonome `.AppImage`
- **Windows :** installateur setup `.exe` (NSIS) ou `.msi`
- **macOS :** image disque `.dmg` et paquet `.app`
