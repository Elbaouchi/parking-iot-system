// ===== Configuration MQTT =====
const MQTT_CONFIG = {
    host: 'localhost',
    port: 9001,
    clientId: 'dashboard_' + Math.random().toString(16).substr(2, 8)
};

const BACKEND_API = 'http://localhost:5000';

// ===== Variables globales =====
let mqttClient = null;
let realtimeChart = null;
let pieChart = null;
let hourlyChart = null;

let parkingData = {
    zones: {
        'Zone_A': {},
        'Zone_B': {},
        'Zone_C': {}
    },
    summary: {
        total_places: 0,
        occupied: 0,
        free: 0,
        occupancy_rate: 0
    },
    history: []
};

// Historique pour le graphique temps réel
let realtimeData = {
    labels: [],
    occupancy: [],
    free: []
};

// Seuils d'alerte
const ALERT_THRESHOLDS = {
    HIGH: 85,    // >85% = Parking presque plein
    MEDIUM: 70,  // >70% = Attention
    LOW: 30      // <30% = Beaucoup de places
};

let lastAlertLevel = null;

// ===== Initialisation =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage du dashboard avancé...');
    initializeCharts();
    initializeMQTT();
    createParkingSpots();
    checkBackendAPI();
    
    // Actualiser les stats backend toutes les 30 secondes
    setInterval(checkBackendAPI, 30000);
});

// ===== Initialisation des Graphiques =====
function initializeCharts() {
    // Graphique temps réel
    const realtimeCtx = document.getElementById('realtimeChart').getContext('2d');
    realtimeChart = new Chart(realtimeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Taux d\'Occupation (%)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Places Libres',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Graphique camembert (zones)
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Zone A', 'Zone B', 'Zone C'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b'
                ],
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} places (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Graphique horaire
    const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
    hourlyChart = new Chart(hourlyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Taux d\'Occupation Moyen (%)',
                data: [],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Taux moyen: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    console.log('✅ Graphiques initialisés');
}

// ===== Connexion MQTT =====
function initializeMQTT() {
    console.log('🔌 Connexion au broker MQTT...');
    
    mqttClient = new Paho.MQTT.Client(
        MQTT_CONFIG.host,
        MQTT_CONFIG.port,
        MQTT_CONFIG.clientId
    );
    
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;
    
    const connectOptions = {
        onSuccess: onConnect,
        onFailure: onConnectFailure
    };
    
    mqttClient.connect(connectOptions);
}

function onConnect() {
    console.log('✅ Connecté au broker MQTT!');
    updateConnectionStatus(true);
    
    mqttClient.subscribe('parking/#');
    console.log('📡 Abonné aux topics: parking/#');
    
    addLogEntry('Système connecté et opérationnel', 'success');
    showAlert('Connexion établie', 'Connecté au système IoT', 'success');
}

function onConnectFailure(error) {
    console.error('❌ Échec de connexion:', error);
    updateConnectionStatus(false);
    addLogEntry('Erreur de connexion au broker MQTT', 'error');
    showAlert('Erreur de connexion', 'Impossible de se connecter au broker MQTT', 'danger');
    
    setTimeout(initializeMQTT, 5000);
}

function onConnectionLost(response) {
    console.warn('⚠️ Connexion perdue:', response.errorMessage);
    updateConnectionStatus(false);
    addLogEntry('Connexion perdue - Tentative de reconnexion...', 'warning');
    showAlert('Connexion perdue', 'Reconnexion en cours...', 'warning');
    
    setTimeout(initializeMQTT, 3000);
}

function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    try {
        const data = JSON.parse(payload);
        
        if (topic === 'parking/summary') {
            updateSummary(data);
            updateRealtimeChart(data);
            checkAlerts(data);
        } else {
            updateParkingSpot(topic, data);
        }
        
        updateLastUpdate();
    } catch (error) {
        console.error('Erreur parsing JSON:', error);
    }
}

// ===== Mise à jour du résumé =====
function updateSummary(data) {
    parkingData.summary = data;
    
    // Statistiques principales
    document.getElementById('total-places').textContent = data.total_places;
    document.getElementById('free-places').textContent = data.free;
    document.getElementById('occupied-places').textContent = data.occupied;
    document.getElementById('occupancy-rate').textContent = data.occupancy_rate + '%';
    
    // Pourcentages
    const freePercentage = ((data.free / data.total_places) * 100).toFixed(1);
    const occupiedPercentage = ((data.occupied / data.total_places) * 100).toFixed(1);
    
    document.getElementById('free-percentage').textContent = freePercentage + '%';
    document.getElementById('occupied-percentage').textContent = occupiedPercentage + '%';
    
    // Statut d'occupation
    let statusText = '';
    if (data.occupancy_rate >= ALERT_THRESHOLDS.HIGH) {
        statusText = '🔴 Critique';
    } else if (data.occupancy_rate >= ALERT_THRESHOLDS.MEDIUM) {
        statusText = '🟡 Modéré';
    } else {
        statusText = '🟢 Optimal';
    }
    document.getElementById('occupancy-status').textContent = statusText;
    
    // Barre de progression
    updateProgressBar(data);
    
    // Mettre à jour les stats par zone
    updateZoneStats();
}

function updateProgressBar(data) {
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');
    const progressText = progressFill.querySelector('.progress-text');
    
    progressFill.style.width = data.occupancy_rate + '%';
    
    if (progressText) {
        progressText.textContent = data.occupancy_rate + '%';
    }
    
    progressLabel.textContent = `${data.occupancy_rate}% occupé (${data.occupied}/${data.total_places} places)`;
    
    // Changer la couleur selon le taux
    if (data.occupancy_rate >= ALERT_THRESHOLDS.HIGH) {
        progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    } else if (data.occupancy_rate >= ALERT_THRESHOLDS.MEDIUM) {
        progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    } else {
        progressFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    }
}

// ===== Mise à jour d'une place =====
function updateParkingSpot(topic, data) {
    const zone = data.zone;
    const sensorId = data.sensor_id;
    const status = data.status;
    
    if (!parkingData.zones[zone]) {
        parkingData.zones[zone] = {};
    }
    parkingData.zones[zone][sensorId] = data;
    
    // Mettre à jour visuellement
    const spotId = `${zone.toLowerCase().replace('_', '-')}-${sensorId}`;
    const spotElement = document.getElementById(spotId);
    
    if (spotElement) {
        spotElement.className = 'parking-spot ' + status;
        
        const icon = spotElement.querySelector('.spot-icon');
        if (icon) {
            icon.textContent = status === 'free' ? '✅' : '🚗';
        }
        
        // Animation
        spotElement.style.transform = 'scale(1.15) rotate(5deg)';
        setTimeout(() => {
            spotElement.style.transform = 'scale(1) rotate(0deg)';
        }, 300);
    }
    
    // Ajouter au journal
    const statusText = status === 'free' ? 'LIBRE' : 'OCCUPÉE';
    const statusIcon = status === 'free' ? '✅' : '🚗';
    addLogEntry(`${statusIcon} ${zone} - Place ${sensorId}: ${statusText}`, status);
    
    // Mettre à jour les stats de zone
    updateZoneStats();
}

// ===== Mise à jour des stats par zone =====
function updateZoneStats() {
    ['Zone_A', 'Zone_B', 'Zone_C'].forEach(zone => {
        const zoneData = parkingData.zones[zone];
        const total = Object.keys(zoneData).length;
        const occupied = Object.values(zoneData).filter(s => s.status === 'occupied').length;
        const free = total - occupied;
        
        const zoneId = zone.toLowerCase().replace('_', '-');
        const statsElement = document.getElementById(`${zoneId}-stats`);
        
        if (statsElement && total > 0) {
            statsElement.textContent = `${free} libres / ${total}`;
        }
    });
    
    // Mettre à jour le graphique camembert
    updatePieChart();
}

// ===== Graphique temps réel =====
function updateRealtimeChart(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    realtimeData.labels.push(timeLabel);
    realtimeData.occupancy.push(data.occupancy_rate);
    realtimeData.free.push(data.free);
    
    // Garder seulement les 30 dernières minutes (30 points)
    if (realtimeData.labels.length > 30) {
        realtimeData.labels.shift();
        realtimeData.occupancy.shift();
        realtimeData.free.shift();
    }
    
    realtimeChart.data.labels = realtimeData.labels;
    realtimeChart.data.datasets[0].data = realtimeData.occupancy;
    realtimeChart.data.datasets[1].data = realtimeData.free;
    realtimeChart.update('none'); // Animation désactivée pour meilleures performances
}

// ===== Graphique camembert (zones) =====
function updatePieChart() {
    const zoneA = Object.values(parkingData.zones['Zone_A']).filter(s => s.status === 'occupied').length;
    const zoneB = Object.values(parkingData.zones['Zone_B']).filter(s => s.status === 'occupied').length;
    const zoneC = Object.values(parkingData.zones['Zone_C']).filter(s => s.status === 'occupied').length;
    
    pieChart.data.datasets[0].data = [zoneA, zoneB, zoneC];
    pieChart.update('none');
}

// ===== Créer les places de parking =====
function createParkingSpots() {
    const zones = {
        'zone-a': { name: 'Zone_A', count: 8 },
        'zone-b': { name: 'Zone_B', count: 6 },
        'zone-c': { name: 'Zone_C', count: 10 }
    };
    
    Object.keys(zones).forEach(zoneId => {
        const container = document.getElementById(zoneId);
        const zoneData = zones[zoneId];
        
        for (let i = 1; i <= zoneData.count; i++) {
            const spot = document.createElement('div');
            spot.id = `${zoneId}-${i}`;
            spot.className = 'parking-spot free';
            spot.innerHTML = `
                <span class="spot-icon">✅</span>
                <span class="spot-number">Place ${i}</span>
            `;
            spot.title = `${zoneData.name} - Place ${i}`;
            
            container.appendChild(spot);
        }
    });
}

// ===== Système d'alertes =====
function checkAlerts(data) {
    const rate = data.occupancy_rate;
    let currentLevel = null;
    
    if (rate >= ALERT_THRESHOLDS.HIGH) {
        currentLevel = 'high';
    } else if (rate >= ALERT_THRESHOLDS.MEDIUM) {
        currentLevel = 'medium';
    }
    
    // Afficher une alerte seulement si le niveau change
    if (currentLevel !== lastAlertLevel && currentLevel !== null) {
        if (currentLevel === 'high') {
            showAlert(
                '⚠️ Parking Presque Plein',
                `Seulement ${data.free} places disponibles (${rate}%)`,
                'danger',
                8000
            );
        } else if (currentLevel === 'medium') {
            showAlert(
                '⚠️ Occupation Élevée',
                `${data.free} places disponibles (${rate}%)`,
                'warning',
                5000
            );
        }
    }
    
    lastAlertLevel = currentLevel;
}

function showAlert(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('alert-container');
    
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    
    const icons = {
        success: '✅',
        warning: '⚠️',
        danger: '🚨',
        info: 'ℹ️'
    };
    
    alert.innerHTML = `
        <div class="alert-icon">${icons[type]}</div>
        <div class="alert-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    container.appendChild(alert);
    
    // Supprimer après la durée spécifiée
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(100px)';
        setTimeout(() => alert.remove(), 300);
    }, duration);
}

// ===== Journal d'activité =====
function addLogEntry(message, type = 'info') {
    const logContainer = document.getElementById('activity-log');
    
    const emptyMsg = logContainer.querySelector('.log-empty');
    if (emptyMsg) {
        emptyMsg.remove();
    }
    
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR');
    
    entry.innerHTML = `
        <div class="log-time">${timeString}</div>
        <div class="log-message">${message}</div>
    `;
    
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    // Limiter à 100 entrées
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 100) {
        entries[entries.length - 1].remove();
    }
}

function clearLog() {
    const logContainer = document.getElementById('activity-log');
    logContainer.innerHTML = '<p class="log-empty">Journal effacé</p>';
}

// ===== Backend API =====
async function checkBackendAPI() {
    try {
        const response = await fetch(`${BACKEND_API}/api/health`);
        
        if (response.ok) {
            const data = await response.json();
            
            document.getElementById('backend-status').textContent = '🟢';
            document.getElementById('backend-status').style.color = '#10b981';
            document.getElementById('api-status').textContent = 'En ligne';
            
            // Charger les statistiques
            await loadBackendStats();
        }
    } catch (error) {
        document.getElementById('backend-status').textContent = '🔴';
        document.getElementById('backend-status').style.color = '#ef4444';
        document.getElementById('api-status').textContent = 'Hors ligne';
        console.log('Backend API non disponible (optionnel)');
    }
}

async function loadBackendStats() {
    try {
        // Statistiques horaires
        const hourlyResponse = await fetch(`${BACKEND_API}/api/stats/hourly`);
        if (hourlyResponse.ok) {
            const data = await hourlyResponse.json();
            
            if (data.success && data.statistics.length > 0) {
                // Mettre à jour le graphique horaire
                const labels = data.statistics.map(s => `${s.hour}h`);
                const values = data.statistics.map(s => s.avg_occupancy);
                
                hourlyChart.data.labels = labels;
                hourlyChart.data.datasets[0].data = values;
                hourlyChart.update();
                
                document.getElementById('hours-tracked').textContent = data.statistics.length;
            }
        }
        
        // Événements récents
        const eventsResponse = await fetch(`${BACKEND_API}/api/events?limit=10`);
        if (eventsResponse.ok) {
            const data = await eventsResponse.json();
            
            if (data.success) {
                document.getElementById('total-events').textContent = data.count;
                
                if (data.events.length > 0) {
                    const lastEvent = data.events[0];
                    const eventTime = new Date(lastEvent.timestamp);
                    document.getElementById('last-save').textContent = eventTime.toLocaleTimeString('fr-FR');
                }
            }
        }
        
    } catch (error) {
        console.log('Erreur chargement stats backend:', error);
    }
}

// ===== Export CSV =====
function exportToCSV() {
    let csv = 'Zone,Place,Statut,Timestamp\n';
    
    Object.keys(parkingData.zones).forEach(zone => {
        Object.values(parkingData.zones[zone]).forEach(spot => {
            csv += `${zone},${spot.sensor_id},${spot.status},${spot.timestamp}\n`;
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parking-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    showAlert('Export CSV', 'Données exportées avec succès', 'success', 3000);
}

// ===== Export Excel =====
function exportToExcel() {
    const data = [];
    
    // En-têtes
    data.push(['Zone', 'Place', 'Statut', 'Confiance', 'Timestamp']);
    
    // Données
    Object.keys(parkingData.zones).forEach(zone => {
        Object.values(parkingData.zones[zone]).forEach(spot => {
            data.push([
                zone,
                spot.sensor_id,
                spot.status === 'free' ? 'LIBRE' : 'OCCUPÉE',
                (spot.confidence * 100).toFixed(1) + '%',
                spot.timestamp
            ]);
        });
    });
    
    // Créer le workbook
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parking Data');
    
    // Télécharger
    XLSX.writeFile(wb, `parking-data-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showAlert('Export Excel', 'Données exportées avec succès', 'success', 3000);
}

// ===== Filtrage des zones =====
function filterZone(zoneName) {
    const containers = document.querySelectorAll('.zone-container');
    const buttons = document.querySelectorAll('.filter-btn');
    
    // Mettre à jour les boutons actifs
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Filtrer les zones
    containers.forEach(container => {
        const containerZone = container.getAttribute('data-zone');
        
        if (zoneName === 'all' || containerZone === zoneName) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });
}

// ===== Actualiser les données =====
function refreshData() {
    showAlert('Actualisation', 'Rechargement des données...', 'info', 2000);
    checkBackendAPI();
}

// ===== Utilitaires =====
function updateConnectionStatus(isConnected) {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isConnected) {
        indicator.className = 'status-dot connected';
        statusText.textContent = 'Connecté';
    } else {
        indicator.className = 'status-dot disconnected';
        statusText.textContent = 'Déconnecté';
    }
}

function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR');
    document.getElementById('last-update').textContent = timeString;
}

// ===== Gestion des erreurs =====
window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
});

console.log('✅ Dashboard Pro chargé');