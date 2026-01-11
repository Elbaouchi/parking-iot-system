# Configuration Mosquitto Broker

## Utilisation

Pour utiliser cette configuration :

1. Copier `mosquitto.conf` vers `C:\Program Files\mosquitto\`
2. Redémarrer Mosquitto :
```bash
   net stop mosquitto
   net start mosquitto
```

## Ports

- **1883** : MQTT standard (capteurs IoT)
- **9001** : WebSocket (dashboard web)

## Logs

Les logs sont stockés dans :
`C:\Program Files\mosquitto\mosquitto.log`