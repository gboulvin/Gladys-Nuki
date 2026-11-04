// -----------------------------------------------------------------------------
// Runtime texts in the four languages of the integration (English, French,
// German, Spanish). Every message the integration sends to Gladys (action
// results, connection status, widget contents, transport tooltips) is a
// multi-language object built here; Gladys picks the user's language, with
// `en` as fallback. The manifest texts live in gladys-assistant-integration.json.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const MESSAGES = {
  // --- Connection status ------------------------------------------------------
  not_configured: {
    en: 'Configure a Nuki Bridge, an MQTT broker or a Nuki Web API token.',
    fr: 'Configurez un Nuki Bridge, un broker MQTT ou un jeton d’API Nuki Web.',
    de: 'Konfigurieren Sie eine Nuki Bridge, einen MQTT-Broker oder ein Nuki Web API-Token.',
    es: 'Configure un Nuki Bridge, un broker MQTT o un token de la API Nuki Web.',
  },
  all_backends_down: {
    en: 'No Nuki connection works: {errors}',
    fr: 'Aucune connexion Nuki ne fonctionne : {errors}',
    de: 'Keine Nuki-Verbindung funktioniert: {errors}',
    es: 'Ninguna conexión Nuki funciona: {errors}',
  },
  init_failed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, prüfen Sie die Protokolle der Integration.',
    es: 'La inicialización falló, consulte los registros de la integración.',
  },

  // --- Transport badge ------------------------------------------------------
  degraded_local_down: {
    en: 'Local connection unavailable, using Nuki Web (cloud).',
    fr: 'Connexion locale indisponible, utilisation de Nuki Web (cloud).',
    de: 'Lokale Verbindung nicht verfügbar, Nuki Web (Cloud) wird verwendet.',
    es: 'Conexión local no disponible, se usa Nuki Web (nube).',
  },
  degraded_cloud_down: {
    en: 'Nuki Web unavailable, using the local connection.',
    fr: 'Nuki Web indisponible, utilisation de la connexion locale.',
    de: 'Nuki Web nicht verfügbar, die lokale Verbindung wird verwendet.',
    es: 'Nuki Web no disponible, se usa la conexión local.',
  },

  // --- Manifest actions -----------------------------------------------------
  test_bridge_ok: {
    en: 'Bridge OK: {count} device(s), firmware {firmware}.',
    fr: 'Bridge OK : {count} appareil(s), firmware {firmware}.',
    de: 'Bridge OK: {count} Gerät(e), Firmware {firmware}.',
    es: 'Bridge OK: {count} dispositivo(s), firmware {firmware}.',
  },
  test_bridge_ko: {
    en: 'Bridge: {error}',
    fr: 'Bridge : {error}',
    de: 'Bridge: {error}',
    es: 'Bridge: {error}',
  },
  test_mqtt_ok: {
    en: 'MQTT OK: {count} lock(s) seen.',
    fr: 'MQTT OK : {count} serrure(s) vue(s).',
    de: 'MQTT OK: {count} Schloss/Schlösser gesehen.',
    es: 'MQTT OK: {count} cerradura(s) detectada(s).',
  },
  test_mqtt_ko: {
    en: 'MQTT: not connected to the broker ({error}).',
    fr: 'MQTT : non connecté au broker ({error}).',
    de: 'MQTT: nicht mit dem Broker verbunden ({error}).',
    es: 'MQTT: sin conexión con el broker ({error}).',
  },
  test_web_ok: {
    en: 'Nuki Web OK: {count} device(s).',
    fr: 'Nuki Web OK : {count} appareil(s).',
    de: 'Nuki Web OK: {count} Gerät(e).',
    es: 'Nuki Web OK: {count} dispositivo(s).',
  },
  test_web_ko: {
    en: 'Nuki Web: {error}',
    fr: 'Nuki Web : {error}',
    de: 'Nuki Web: {error}',
    es: 'Nuki Web: {error}',
  },
  discover_none: {
    en: 'No Nuki Bridge found on your network. Check that it is online, or enter its IP address by hand.',
    fr: 'Aucun Nuki Bridge trouvé sur votre réseau. Vérifiez qu’il est en ligne, ou saisissez son adresse IP.',
    de: 'Keine Nuki Bridge in Ihrem Netzwerk gefunden. Prüfen Sie, ob sie online ist, oder geben Sie ihre IP-Adresse ein.',
    es: 'No se encontró ningún Nuki Bridge en su red. Compruebe que está en línea o introduzca su dirección IP.',
  },
  discover_found: {
    en: 'Bridge found at {ip}:{port}, saved in the configuration.',
    fr: 'Bridge trouvé à {ip}:{port}, enregistré dans la configuration.',
    de: 'Bridge unter {ip}:{port} gefunden und in der Konfiguration gespeichert.',
    es: 'Bridge encontrado en {ip}:{port}, guardado en la configuración.',
  },
  discover_found_many: {
    en: 'Bridges found: {list}. Enter the IP address of yours in the configuration.',
    fr: 'Bridges trouvés : {list}. Saisissez l’adresse IP du vôtre dans la configuration.',
    de: 'Gefundene Bridges: {list}. Geben Sie die IP-Adresse Ihrer Bridge in der Konfiguration ein.',
    es: 'Bridges encontrados: {list}. Introduzca la dirección IP del suyo en la configuración.',
  },
  pair_no_ip: {
    en: 'Enter the Bridge IP address first (or use “Find my Bridge”).',
    fr: 'Saisissez d’abord l’adresse IP du Bridge (ou utilisez « Trouver mon Bridge »).',
    de: 'Geben Sie zuerst die IP-Adresse der Bridge ein (oder nutzen Sie „Meine Bridge finden“).',
    es: 'Introduzca primero la dirección IP del Bridge (o use «Buscar mi Bridge»).',
  },
  pair_ok: {
    en: 'Bridge paired: the API token is saved.',
    fr: 'Bridge appairé : le jeton d’API est enregistré.',
    de: 'Bridge gekoppelt: das API-Token ist gespeichert.',
    es: 'Bridge emparejado: el token de la API está guardado.',
  },
  pair_ko: {
    en: 'Pairing failed: {error}. Press the Bridge button as soon as you click, and check that the HTTP API is enabled in the Nuki app.',
    fr: 'Appairage échoué : {error}. Appuyez sur le bouton du Bridge dès le clic, et vérifiez que l’API HTTP est activée dans l’app Nuki.',
    de: 'Kopplung fehlgeschlagen: {error}. Drücken Sie den Bridge-Knopf direkt nach dem Klick und prüfen Sie, ob die HTTP-API in der Nuki-App aktiviert ist.',
    es: 'Emparejamiento fallido: {error}. Pulse el botón del Bridge justo después de hacer clic y compruebe que la API HTTP está activada en la app Nuki.',
  },
  refresh_done: {
    en: 'Refreshed: {count} device(s).',
    fr: 'Actualisé : {count} appareil(s).',
    de: 'Aktualisiert: {count} Gerät(e).',
    es: 'Actualizado: {count} dispositivo(s).',
  },

  // --- Commands and widget toasts --------------------------------------------
  action_sent: {
    en: '{device}: {action} sent.',
    fr: '{device} : {action} envoyé.',
    de: '{device}: {action} gesendet.',
    es: '{device}: {action} enviado.',
  },
  lock_all_done: {
    en: '{count} lock(s) locked, {failed} failure(s).',
    fr: '{count} serrure(s) verrouillée(s), {failed} échec(s).',
    de: '{count} Schloss/Schlösser verriegelt, {failed} Fehler.',
    es: '{count} cerradura(s) bloqueada(s), {failed} fallo(s).',
  },
  unknown_device: {
    en: 'Unknown Nuki device.',
    fr: 'Appareil Nuki inconnu.',
    de: 'Unbekanntes Nuki-Gerät.',
    es: 'Dispositivo Nuki desconocido.',
  },

  // --- Widget labels ----------------------------------------------------------
  w_state: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  w_battery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  w_door: { en: 'Door', fr: 'Porte', de: 'Tür', es: 'Puerta' },
  w_keypad: {
    en: 'Keypad battery',
    fr: 'Pile du clavier',
    de: 'Keypad-Batterie',
    es: 'Pila del teclado',
  },
  w_door_sensor: {
    en: 'Door sensor battery',
    fr: 'Pile du capteur de porte',
    de: 'Türsensor-Batterie',
    es: 'Pila del sensor de puerta',
  },
  w_connection: { en: 'Connection', fr: 'Connexion', de: 'Verbindung', es: 'Conexión' },
  w_last_activity: {
    en: 'Last activity',
    fr: 'Dernière activité',
    de: 'Letzte Aktivität',
    es: 'Última actividad',
  },
  w_ring_to_open: {
    en: 'Ring to Open',
    fr: 'Ring to Open',
    de: 'Ring to Open',
    es: 'Ring to Open',
  },
  w_continuous: {
    en: 'Continuous mode',
    fr: 'Mode continu',
    de: 'Daueröffnung',
    es: 'Modo continuo',
  },
  w_lock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Bloquear' },
  w_unlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Desbloquear' },
  w_unlatch: { en: 'Open door', fr: 'Ouvrir la porte', de: 'Tür öffnen', es: 'Abrir la puerta' },
  w_open: { en: 'Open', fr: 'Ouvrir', de: 'Öffnen', es: 'Abrir' },
  w_rto_on: { en: 'Ring to Open on', fr: 'Activer RTO', de: 'RTO ein', es: 'Activar RTO' },
  w_rto_off: { en: 'Ring to Open off', fr: 'Désactiver RTO', de: 'RTO aus', es: 'Desactivar RTO' },
  w_lock_all: {
    en: 'Lock all',
    fr: 'Tout verrouiller',
    de: 'Alle verriegeln',
    es: 'Bloquear todo',
  },
  w_choose_device: {
    en: 'Choose a Nuki device in the widget settings.',
    fr: 'Choisissez un appareil Nuki dans les réglages du widget.',
    de: 'Wählen Sie ein Nuki-Gerät in den Widget-Einstellungen.',
    es: 'Elija un dispositivo Nuki en los ajustes del widget.',
  },
  w_no_device: {
    en: 'No Nuki device yet: create them in the Discovery tab.',
    fr: 'Aucun appareil Nuki : créez-les dans l’onglet Découverte.',
    de: 'Noch kein Nuki-Gerät: legen Sie sie im Tab „Erkennung“ an.',
    es: 'Aún no hay dispositivos Nuki: créelos en la pestaña Descubrimiento.',
  },
  w_no_activity: {
    en: 'No activity recorded yet.',
    fr: 'Aucune activité enregistrée pour le moment.',
    de: 'Noch keine Aktivität aufgezeichnet.',
    es: 'Aún no hay actividad registrada.',
  },
  w_unavailable: {
    en: 'This device is not reachable right now.',
    fr: 'Cet appareil est injoignable pour le moment.',
    de: 'Dieses Gerät ist derzeit nicht erreichbar.',
    es: 'Este dispositivo no está accesible ahora mismo.',
  },
  ok: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  critical: { en: 'Critical', fr: 'Critique', de: 'Kritisch', es: 'Crítica' },
  door_open: { en: 'Open', fr: 'Ouverte', de: 'Offen', es: 'Abierta' },
  door_closed: { en: 'Closed', fr: 'Fermée', de: 'Geschlossen', es: 'Cerrada' },
  door_unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  on: { en: 'On', fr: 'Activé', de: 'Ein', es: 'Activado' },
  off: { en: 'Off', fr: 'Désactivé', de: 'Aus', es: 'Desactivado' },
  transport_local: { en: 'Local', fr: 'Locale', de: 'Lokal', es: 'Local' },
  transport_cloud: { en: 'Cloud', fr: 'Cloud', de: 'Cloud', es: 'Nube' },
  transport_unreachable: {
    en: 'Unreachable',
    fr: 'Injoignable',
    de: 'Nicht erreichbar',
    es: 'Inaccesible',
  },
  by_user: {
    en: '{action} by {user}',
    fr: '{action} par {user}',
    de: '{action} durch {user}',
    es: '{action} por {user}',
  },
  via_trigger: {
    en: '{action} ({trigger})',
    fr: '{action} ({trigger})',
    de: '{action} ({trigger})',
    es: '{action} ({trigger})',
  },
};

// Lock / opener states, actions, triggers, errors: one label per language.
const LABELS = {
  state: {
    uncalibrated: {
      en: 'Uncalibrated',
      fr: 'Non calibrée',
      de: 'Nicht kalibriert',
      es: 'Sin calibrar',
    },
    locked: { en: 'Locked', fr: 'Verrouillée', de: 'Verriegelt', es: 'Bloqueada' },
    unlocking: {
      en: 'Unlocking',
      fr: 'Déverrouillage',
      de: 'Entriegelung läuft',
      es: 'Desbloqueando',
    },
    unlocked: { en: 'Unlocked', fr: 'Déverrouillée', de: 'Entriegelt', es: 'Desbloqueada' },
    locking: { en: 'Locking', fr: 'Verrouillage', de: 'Verriegelung läuft', es: 'Bloqueando' },
    unlatched: { en: 'Unlatched', fr: 'Ouverte', de: 'Geöffnet', es: 'Abierta' },
    unlocked_lock_n_go: {
      en: "Lock 'n' Go",
      fr: "Lock 'n' Go",
      de: "Lock 'n' Go",
      es: "Lock 'n' Go",
    },
    unlatching: { en: 'Opening', fr: 'Ouverture', de: 'Öffnet…', es: 'Abriendo' },
    boot_run: { en: 'Starting', fr: 'Démarrage', de: 'Startet', es: 'Arrancando' },
    motor_blocked: {
      en: 'Motor blocked',
      fr: 'Moteur bloqué',
      de: 'Motor blockiert',
      es: 'Motor bloqueado',
    },
    undefined: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
    untrained: {
      en: 'Not set up',
      fr: 'Non configuré',
      de: 'Nicht eingerichtet',
      es: 'Sin configurar',
    },
    online: { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' },
    rto_active: { en: 'Ring to Open', fr: 'Ring to Open', de: 'Ring to Open', es: 'Ring to Open' },
    open: { en: 'Open', fr: 'Ouvert', de: 'Offen', es: 'Abierto' },
    opening: { en: 'Opening', fr: 'Ouverture', de: 'Öffnet…', es: 'Abriendo' },
  },
  action: {
    unlock: { en: 'Unlock', fr: 'Déverrouillage', de: 'Entriegeln', es: 'Desbloqueo' },
    lock: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegeln', es: 'Bloqueo' },
    unlatch: {
      en: 'Door opening',
      fr: 'Ouverture de porte',
      de: 'Türöffnung',
      es: 'Apertura de puerta',
    },
    lock_n_go: { en: "Lock 'n' Go", fr: "Lock 'n' Go", de: "Lock 'n' Go", es: "Lock 'n' Go" },
    lock_n_go_unlatch: {
      en: "Lock 'n' Go with unlatch",
      fr: "Lock 'n' Go avec ouverture",
      de: "Lock 'n' Go mit Öffnen",
      es: "Lock 'n' Go con apertura",
    },
    full_lock: {
      en: 'Full lock',
      fr: 'Verrouillage complet',
      de: 'Doppelt verriegeln',
      es: 'Bloqueo completo',
    },
    activate_rto: {
      en: 'Ring to Open on',
      fr: 'Ring to Open activé',
      de: 'Ring to Open ein',
      es: 'Ring to Open activado',
    },
    deactivate_rto: {
      en: 'Ring to Open off',
      fr: 'Ring to Open désactivé',
      de: 'Ring to Open aus',
      es: 'Ring to Open desactivado',
    },
    electric_strike: {
      en: 'Door buzzer',
      fr: 'Ouverture gâche',
      de: 'Türsummer',
      es: 'Abrepuertas',
    },
    activate_continuous: {
      en: 'Continuous mode on',
      fr: 'Mode continu activé',
      de: 'Daueröffnung ein',
      es: 'Modo continuo activado',
    },
    deactivate_continuous: {
      en: 'Continuous mode off',
      fr: 'Mode continu désactivé',
      de: 'Daueröffnung aus',
      es: 'Modo continuo desactivado',
    },
    doorbell: { en: 'Doorbell rang', fr: 'Sonnette', de: 'Klingel', es: 'Timbre' },
    error: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
    battery: {
      en: 'Battery critical',
      fr: 'Batterie critique',
      de: 'Batterie kritisch',
      es: 'Batería crítica',
    },
  },
  trigger: {
    app: { en: 'app', fr: 'app', de: 'App', es: 'app' },
    manual: { en: 'by hand', fr: 'à la main', de: 'von Hand', es: 'a mano' },
    button: { en: 'button', fr: 'bouton', de: 'Knopf', es: 'botón' },
    automatic: { en: 'automatic', fr: 'automatique', de: 'automatisch', es: 'automático' },
    web: { en: 'Nuki Web', fr: 'Nuki Web', de: 'Nuki Web', es: 'Nuki Web' },
    auto_lock: {
      en: 'auto lock',
      fr: 'verrouillage auto',
      de: 'Auto-Lock',
      es: 'bloqueo automático',
    },
    accessory: { en: 'accessory', fr: 'accessoire', de: 'Zubehör', es: 'accesorio' },
    keypad: { en: 'keypad', fr: 'clavier', de: 'Keypad', es: 'teclado' },
    fingerprint: { en: 'fingerprint', fr: 'empreinte', de: 'Fingerabdruck', es: 'huella' },
    homekit: {
      en: 'HomeKit / Matter',
      fr: 'HomeKit / Matter',
      de: 'HomeKit / Matter',
      es: 'HomeKit / Matter',
    },
    mqtt: { en: 'MQTT', fr: 'MQTT', de: 'MQTT', es: 'MQTT' },
    gladys: { en: 'Gladys', fr: 'Gladys', de: 'Gladys', es: 'Gladys' },
    unknown: { en: 'unknown', fr: 'inconnu', de: 'unbekannt', es: 'desconocido' },
  },
  error: {
    motor_blocked: {
      en: 'Motor blocked',
      fr: 'Moteur bloqué',
      de: 'Motor blockiert',
      es: 'Motor bloqueado',
    },
    uncalibrated: {
      en: 'Uncalibrated',
      fr: 'Non calibrée',
      de: 'Nicht kalibriert',
      es: 'Sin calibrar',
    },
    command_failed: {
      en: 'Command failed',
      fr: 'Commande échouée',
      de: 'Befehl fehlgeschlagen',
      es: 'Orden fallida',
    },
  },
};

function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return match;
    }
    // A parameter can itself be multi-language: the caller resolves it per language.
    return String(value);
  });
}

/**
 * Multi-language message `{ en, fr, de, es }` for `key`. A parameter may be a
 * plain value or a multi-language object (resolved per language).
 */
export function t(key, params = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message key: ${key}`);
  }
  return Object.fromEntries(
    LANGUAGES.map((lang) => {
      const resolved = Object.fromEntries(
        Object.entries(params).map(([name, value]) => [
          name,
          value && typeof value === 'object' ? (value[lang] ?? value.en) : value,
        ]),
      );
      return [lang, interpolate(message[lang] ?? message.en, resolved)];
    }),
  );
}

/** Multi-language label of a state / action / trigger / error, `en` fallback to the raw key. */
export function label(group, key) {
  return (
    LABELS[group]?.[key] ?? { en: String(key), fr: String(key), de: String(key), es: String(key) }
  );
}

/** Truncate every language of a multi-language text (widget fields have caps). */
export function truncate(text, max) {
  return Object.fromEntries(
    Object.entries(text).map(([lang, value]) => [
      lang,
      value.length > max ? `${value.slice(0, max - 1)}…` : value,
    ]),
  );
}

/** Same message in every language (a value that needs no translation). */
export function same(value) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, String(value)]));
}

export const MESSAGE_KEYS = Object.keys(MESSAGES);
export const LABEL_GROUPS = LABELS;
