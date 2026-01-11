# 🚗 Système Intelligent de Détection de Places de Parking

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto-orange.svg)](https://mosquitto.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com/)

Système IoT basé sur MQTT pour la gestion en temps réel des places de parking.

---

## 📋 Description

Ce projet implémente un système complet de détection et de gestion de places de parking utilisant :
- **Protocole MQTT** pour la communication IoT temps réel
- **Simulateur de capteurs** en Python (24 places, 3 zones)
- **Backend Flask** avec API REST et base de données SQLite
- **Dashboard web** interactif avec graphiques Chart.js
- **Système d'alertes** automatiques selon le taux d'occupation

---

## 🎯 Objectifs

- ✅ Détection temps réel de l'occupation des places
- ✅ Visualisation interactive via dashboard web
- ✅ Historisation et analyse des données
- ✅ Système d'alertes automatiques (seuils 70%, 85%)
- ✅ Export des statistiques (CSV/Excel)
- ✅ API REST pour intégration externe

---

## 🏗️ Architecture

```
┌─────────────┐     MQTT      ┌──────────────┐
│  Capteurs   │ ────────────> │   Mosquitto  │
│  (Python)   │               │    Broker    │
└─────────────┘               └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                 ▼
              ┌──────────┐                     ┌─────────────┐
              │ Backend  │                     │  Dashboard  │
              │  Flask   │                     │  Web (JS)   │
              └──────────┘                     └─────────────┘
                    │
                    ▼
              ┌──────────┐
              │  SQLite  │
              │    DB    │
              └──────────┘
```

---

## 🛠️ Technologies Utilisées

| Composant | Technologie |
|-----------|-------------|
| Broker MQTT | Eclipse Mosquitto |
| Backend | Python Flask + SQLite |
| Simulateur | Python 3.x + Paho MQTT |
| Frontend | HTML5/CSS3/JavaScript |
| Visualisation | Chart.js |
| Communication | MQTT WebSocket |
| Export | SheetJS (XLSX) |

---

## 📦 Installation

### Prérequis

- Python 3.8 ou supérieur
- Mosquitto MQTT Broker
- Navigateur web moderne

### Étape 1 : Cloner le repository

```bash
git clone https://github.com/VOTRE-USERNAME/parking-iot-system.git
cd parking-iot-system
```

### Étape 2 : Installer Mosquitto

**Windows :**
- Télécharger depuis [mosquitto.org/download](https://mosquitto.org/download/)
- Installer et ajouter au PATH

**Linux/Mac :**
```bash
sudo apt-get install mosquitto mosquitto-clients  # Ubuntu/Debian
brew install mosquitto                             # macOS
```

### Étape 3 : Installer les dépendances Python

```bash
# Backend
cd backend
pip install -r requirements.txt

# Simulateur
cd ../sensors
pip install -r requirements.txt
```

---

## 🚀 Démarrage Rapide

### Terminal 1 : Démarrer le Broker MQTT

```bash
cd broker
mosquitto -c mosquitto.conf
```

Le broker écoute sur :
- Port **1883** : MQTT standard
- Port **9001** : WebSocket (pour le dashboard web)

### Terminal 2 : Lancer le Backend

```bash
cd backend
python backend_server.py
```

API REST disponible sur `http://localhost:5000`

### Terminal 3 : Démarrer le Simulateur

```bash
cd sensors
python sensor_simulator.py
```

Simule 24 places réparties en 3 zones (A, B, C)

### Terminal 4 : Ouvrir le Dashboard

Ouvrez `dashboard/index.html` dans votre navigateur web.

---

## 📊 Fonctionnalités

### Dashboard Web

- 📈 **4 cartes statistiques** temps réel (total, libres, occupées, taux)
- 📉 **Graphique temps réel** : Évolution sur 30 minutes
- 🥧 **Graphique zones** : Répartition par zone (A, B, C)
- 📊 **Tendances horaires** : Moyennes par heure
- 🗺️ **Carte visuelle** : Plan 2D des 24 places (code couleur)
- 📜 **Journal d'activité** : 100 derniers événements
- 🚨 **Alertes automatiques** : Notifications à 70% et 85%
- 💾 **Export** : CSV et Excel

### API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/current` | GET | État actuel de toutes les places |
| `/api/history` | GET | Historique des événements |
| `/api/stats/hourly` | GET | Statistiques par heure |
| `/api/stats/zones` | GET | Statistiques par zone |

**Exemple :**

```bash
curl http://localhost:5000/api/current
```

---

## 📈 Performances Mesurées

| Métrique | Valeur |
|----------|--------|
| Latence moyenne | < 100 ms |
| Taux de rafraîchissement | 2 secondes |
| Places gérées | 24 (3 zones) |
| Connexions simultanées | 100+ |
| Taille message MQTT | ~150 octets |
| Uptime système | >99% |

---

## ⚠️ Difficultés Rencontrées et Solutions

### 1. Dashboard Node-RED Non Fonctionnel

**Problème :** Dashboard vide malgré flows configurés

**Solution :**
```bash
npm install -g node-red-dashboard
# Changer port dans settings.js si conflit
node-red --verbose
```

### 2. Limitation Ressources Système

**Problème :** CPU >80%, RAM >4GB, latence >500ms

**Solutions :**
- Réduction fréquence simulateur (1s → 2s)
- Limitation places (50 → 24)
- Utilisation threads au lieu de processus

### 3. Synchronisation Données

**Problème :** Désynchronisation dashboard/capteurs

**Solutions :**
- QoS 1 au lieu de QoS 0
- Flag "retain" activé
- Heartbeat toutes les 30s

---

## 🔧 Configuration

### Topics MQTT

```
parking/
├── Zone_A/
│   ├── place_1  → {"status": "free", "confidence": 0.95}
│   ├── place_2  → {"status": "occupied", "confidence": 0.98}
│   └── ...
├── Zone_B/...
├── Zone_C/...
└── summary → {"total": 24, "free": 8, "occupied": 16}
```

---

## 📁 Structure du Projet

```
parking-iot-system/
├── broker/           # Configuration Mosquitto
├── backend/          # API Flask + SQLite
├── sensors/          # Simulateur Python
├── dashboard/        # Interface web
├── docs/             # Documentation + Rapport
├── screenshots/      # Captures d'écran
└── README.md
```

---

## 🔮 Perspectives d'Évolution

### Court terme
- [ ] Capteurs physiques (ESP32 + HC-SR04)
- [ ] Authentification MQTT (TLS/SSL)
- [ ] Application mobile (PWA)

### Moyen terme
- [ ] Machine Learning pour prédiction
- [ ] Système de réservation
- [ ] Intégration GPS/Maps

### Long terme
- [ ] Infrastructure cloud (AWS IoT Core)
- [ ] Paiement automatisé
- [ ] Intégration Smart City

---

## 👨‍💻 Auteur

**EL BAOUCHI SAAD**  
Master IDLD - Université Mohammed V de Rabat  
Encadré par : Pr. Hafssa BENABOUD

---

## 📄 Documentation

- [Rapport complet (PDF)](docs/rapport.pdf)
- [Documentation technique](docs/)

---

## 📝 Licence

Projet académique - Master IDLD 2025-2026

---

⭐ **Si ce projet vous est utile, n'hésitez pas à lui donner une étoile !**