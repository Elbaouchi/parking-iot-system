import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime

class ParkingSensor:
    """Représente un capteur de place de parking"""
    
    def __init__(self, sensor_id, zone):
        self.sensor_id = sensor_id
        self.zone = zone
        self.is_occupied = False
        self.topic = f"parking/{zone}/place_{sensor_id}"
        
    def detect_change(self):
        """Simule un changement d'état aléatoire (voiture arrive/part)"""
        if random.random() < 0.1:  # 10% de chance de changement
            self.is_occupied = not self.is_occupied
            return True
        return False
    
    def get_status(self):
        """Retourne l'état actuel du capteur en JSON"""
        return {
            "sensor_id": self.sensor_id,
            "zone": self.zone,
            "status": "occupied" if self.is_occupied else "free",
            "timestamp": datetime.now().isoformat(),
            "confidence": round(random.uniform(0.85, 1.0), 2)
        }

class ParkingSystem:
    """Système de gestion du parking avec MQTT"""
    
    def __init__(self, broker_address="localhost", broker_port=1883):
        self.client = mqtt.Client(client_id="parking_system_simulator")
        self.broker_address = broker_address
        self.broker_port = broker_port
        self.sensors = []
        
        # Callbacks de connexion
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        
    def on_connect(self, client, userdata, flags, rc):
        """Callback appelé lors de la connexion au broker"""
        if rc == 0:
            print("✅ Connecté au broker MQTT avec succès!")
        else:
            print(f"❌ Échec de connexion, code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback appelé lors de la déconnexion"""
        print("⚠️  Déconnecté du broker MQTT")
    
    def create_parking_lot(self, zones_config):
        """
        Crée un parking avec plusieurs zones
        zones_config: dict {"Zone_A": 10, "Zone_B": 15}
        """
        sensor_count = 0
        for zone, num_places in zones_config.items():
            for i in range(1, num_places + 1):
                sensor = ParkingSensor(sensor_id=i, zone=zone)
                # État initial aléatoire (50% occupé)
                sensor.is_occupied = random.choice([True, False])
                self.sensors.append(sensor)
                sensor_count += 1
        
        print(f"\n🏗️  Parking créé avec succès!")
        print(f"   📊 {sensor_count} places réparties dans {len(zones_config)} zones\n")
        
    def connect(self):
        """Se connecte au broker MQTT"""
        try:
            print(f"🔌 Connexion au broker MQTT ({self.broker_address}:{self.broker_port})...")
            self.client.connect(self.broker_address, self.broker_port, 60)
            self.client.loop_start()
            time.sleep(1)  # Attendre la connexion
        except Exception as e:
            print(f"❌ Erreur de connexion : {e}")
            exit(1)
    
    def publish_status(self, sensor):
        """Publie l'état d'un capteur sur MQTT"""
        payload = json.dumps(sensor.get_status())
        result = self.client.publish(
            sensor.topic,
            payload,
            qos=1,
            retain=True  # Le dernier message reste disponible
        )
        return result.rc == mqtt.MQTT_ERR_SUCCESS
    
    def publish_summary(self):
        """Publie un résumé global du parking"""
        total = len(self.sensors)
        occupied = sum(1 for s in self.sensors if s.is_occupied)
        free = total - occupied
        
        summary = {
            "total_places": total,
            "occupied": occupied,
            "free": free,
            "occupancy_rate": round((occupied / total) * 100, 2),
            "timestamp": datetime.now().isoformat()
        }
        
        self.client.publish(
            "parking/summary",
            json.dumps(summary),
            qos=1,
            retain=True
        )
    
    def display_initial_state(self):
        """Affiche l'état initial de toutes les places"""
        print("📊 État Initial du Parking:")
        print("-" * 50)
        for sensor in self.sensors:
            status_icon = "🚗" if sensor.is_occupied else "✅"
            print(f"   {status_icon} {sensor.zone}/Place_{sensor.sensor_id}: {sensor.get_status()['status']}")
        print("-" * 50 + "\n")
    
    def run_simulation(self, duration_seconds=None):
        """Lance la simulation du parking"""
        print("\n🚀 DÉMARRAGE DE LA SIMULATION")
        print("=" * 60)
        
        # Publier l'état initial
        for sensor in self.sensors:
            self.publish_status(sensor)
        
        self.publish_summary()
        self.display_initial_state()
        
        print("⏱️  Simulation en cours... (Appuyez sur Ctrl+C pour arrêter)\n")
        
        start_time = time.time()
        iteration = 0
        
        try:
            while True:
                iteration += 1
                changes = 0
                
                # Vérifier chaque capteur pour des changements
                for sensor in self.sensors:
                    if sensor.detect_change():
                        if self.publish_status(sensor):
                            changes += 1
                            status_icon = "🚗" if sensor.is_occupied else "✅"
                            status_text = "OCCUPÉE" if sensor.is_occupied else "LIBRE"
                            print(f"{status_icon} [{datetime.now().strftime('%H:%M:%S')}] {sensor.zone}/Place_{sensor.sensor_id} → {status_text}")
                
                # Mettre à jour le résumé si changement
                if changes > 0:
                    self.publish_summary()
                    print(f"   📊 {changes} changement(s) détecté(s)\n")
                
                time.sleep(2)  # Vérifier toutes les 2 secondes
                
                # Arrêter après la durée spécifiée
                if duration_seconds and (time.time() - start_time) >= duration_seconds:
                    break
                    
        except KeyboardInterrupt:
            print("\n\n⏹️  Arrêt de la simulation demandé...")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Nettoie les ressources"""
        print("🧹 Nettoyage...")
        self.client.loop_stop()
        self.client.disconnect()
        print("✅ Déconnexion terminée. Au revoir! 👋\n")


# ====== PROGRAMME PRINCIPAL ======
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🅿️  SYSTÈME IoT DE DÉTECTION DE PLACES DE PARKING")
    print("=" * 60)
    
    # Configuration du broker MQTT
    BROKER_ADDRESS = "localhost"
    BROKER_PORT = 1883
    
    # Créer le système
    parking = ParkingSystem(BROKER_ADDRESS, BROKER_PORT)
    
    # Définir la structure du parking (modifiable)
    zones = {
        "Zone_A": 8,   # 8 places en Zone A
        "Zone_B": 6,   # 6 places en Zone B
        "Zone_C": 10   # 10 places en Zone C
    }
    
    # Initialiser le parking
    parking.create_parking_lot(zones)
    
    # Se connecter au broker
    parking.connect()
    
    # Lancer la simulation
    parking.run_simulation()