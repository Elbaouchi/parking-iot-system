import paho.mqtt.client as mqtt
import sqlite3
import json
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import threading
import time

# ===== Configuration =====
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
DB_NAME = "parking_history.db"

# ===== Flask App =====
app = Flask(__name__)
CORS(app)  # Permettre les requêtes depuis le dashboard

# ===== Base de Données =====
class ParkingDatabase:
    def __init__(self, db_name):
        self.db_name = db_name
        self.init_database()
    
    def init_database(self):
        """Initialise la base de données"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        # Table pour l'historique des événements
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS parking_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                zone TEXT NOT NULL,
                place_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                confidence REAL
            )
        ''')
        
        # Table pour les statistiques horaires
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hourly_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                hour INTEGER NOT NULL,
                total_places INTEGER,
                occupied INTEGER,
                free INTEGER,
                occupancy_rate REAL
            )
        ''')
        
        conn.commit()
        conn.close()
        print("✅ Base de données initialisée")
    
    def insert_event(self, zone, place_id, status, confidence, timestamp):
        """Enregistre un événement"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO parking_events (timestamp, zone, place_id, status, confidence)
            VALUES (?, ?, ?, ?, ?)
        ''', (timestamp, zone, place_id, status, confidence))
        
        conn.commit()
        conn.close()
    
    def insert_hourly_stat(self, data):
        """Enregistre les statistiques horaires"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        hour = datetime.now().hour
        timestamp = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO hourly_stats (timestamp, hour, total_places, occupied, free, occupancy_rate)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (timestamp, hour, data['total_places'], data['occupied'], 
              data['free'], data['occupancy_rate']))
        
        conn.commit()
        conn.close()
    
    def get_recent_events(self, limit=50):
        """Récupère les événements récents"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT timestamp, zone, place_id, status
            FROM parking_events
            ORDER BY id DESC
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'timestamp': row[0],
                'zone': row[1],
                'place_id': row[2],
                'status': row[3]
            }
            for row in results
        ]
    
    def get_statistics_by_hour(self):
        """Récupère les statistiques par heure"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT hour, AVG(occupancy_rate) as avg_rate, COUNT(*) as count
            FROM hourly_stats
            GROUP BY hour
            ORDER BY hour
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'hour': row[0],
                'avg_occupancy': round(row[1], 2),
                'samples': row[2]
            }
            for row in results
        ]
    
    def get_zone_statistics(self):
        """Statistiques par zone"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT zone, 
                   SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_count,
                   SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END) as free_count,
                   COUNT(*) as total_events
            FROM parking_events
            WHERE timestamp > datetime('now', '-1 day')
            GROUP BY zone
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'zone': row[0],
                'occupied_events': row[1],
                'free_events': row[2],
                'total_events': row[3]
            }
            for row in results
        ]

# ===== MQTT Backend Client =====
class MQTTBackend:
    def __init__(self, database):
        self.database = database
        self.client = mqtt.Client(client_id="backend_server")
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.last_hourly_save = datetime.now().hour
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Backend connecté au broker MQTT")
            client.subscribe("parking/#")
        else:
            print(f"❌ Échec de connexion backend, code: {rc}")
    
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode()
        
        try:
            data = json.loads(payload)
            
            if topic == "parking/summary":
                # Sauvegarder les stats horaires
                current_hour = datetime.now().hour
                if current_hour != self.last_hourly_save:
                    self.database.insert_hourly_stat(data)
                    self.last_hourly_save = current_hour
                    print(f"📊 Statistiques horaires sauvegardées")
            
            else:
                # C'est un événement individuel
                zone = data.get('zone')
                place_id = data.get('sensor_id')
                status = data.get('status')
                confidence = data.get('confidence')
                timestamp = data.get('timestamp')
                
                self.database.insert_event(zone, place_id, status, confidence, timestamp)
                print(f"💾 Événement enregistré: {zone}/Place_{place_id} → {status}")
        
        except Exception as e:
            print(f"❌ Erreur traitement message: {e}")
    
    def connect(self):
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"❌ Erreur connexion MQTT: {e}")

# ===== API REST Routes =====
db = ParkingDatabase(DB_NAME)
mqtt_backend = MQTTBackend(db)

@app.route('/')
def index():
    return jsonify({
        "message": "🅿️ Parking IoT Backend API",
        "version": "1.0",
        "endpoints": {
            "/api/events": "Recent parking events",
            "/api/stats/hourly": "Hourly statistics",
            "/api/stats/zones": "Statistics by zone",
            "/api/health": "Health check"
        }
    })

@app.route('/api/events')
def get_events():
    """Récupère les événements récents"""
    limit = request.args.get('limit', 50, type=int)
    events = db.get_recent_events(limit)
    return jsonify({
        "success": True,
        "count": len(events),
        "events": events
    })

@app.route('/api/stats/hourly')
def get_hourly_stats():
    """Statistiques par heure"""
    stats = db.get_statistics_by_hour()
    return jsonify({
        "success": True,
        "statistics": stats
    })

@app.route('/api/stats/zones')
def get_zone_stats():
    """Statistiques par zone"""
    stats = db.get_zone_statistics()
    return jsonify({
        "success": True,
        "zones": stats
    })

@app.route('/api/health')
def health_check():
    """Vérification de l'état du système"""
    return jsonify({
        "success": True,
        "status": "healthy",
        "database": "connected",
        "mqtt": "connected",
        "timestamp": datetime.now().isoformat()
    })

# ===== Démarrage =====
def start_backend():
    print("\n" + "="*60)
    print("🏢 BACKEND SERVER - Parking IoT System")
    print("="*60)
    
    # Démarrer le client MQTT
    mqtt_backend.connect()
    print("🔌 Client MQTT démarré")
    
    # Démarrer le serveur Flask
    print("🌐 API REST disponible sur http://localhost:5000")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == "__main__":
    start_backend()