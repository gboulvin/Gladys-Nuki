# Nuki para Gladys Assistant

Controle sus dispositivos **Nuki** desde Gladys: Smart Lock (todas las generaciones,
3.0 Pro, 4.ª generación, Ultra), Smart Door y Opener — bloquear, desbloquear, abrir la
puerta, vigilar las baterías, el sensor de puerta y el teclado, y reaccionar a cada
operación en sus escenas.

## Elegir cómo habla Gladys con sus dispositivos Nuki

La integración ofrece tres canales. Configure **al menos uno**; puede combinarlos.

| Canal           | Tipo                | Dispositivos                                 | Qué aporta                                                                  |
| --------------- | ------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| **Nuki Bridge** | Local (HTTP)        | Todas las Smart Lock, Smart Door y Opener    | Funciona sin internet, detección del timbre del Opener                      |
| **MQTT**        | Local (tiempo real) | Smart Lock 3.0 Pro, 4.ª generación, Ultra    | Actualizaciones instantáneas sin sondeo, quién/cómo (botón, teclado…)       |
| **Nuki Web**    | Nube                | Todos los dispositivos de su cuenta Nuki Web | Quién accionó la cerradura (nombre, teclado, huella), registro de actividad |

Cuando varios canales llegan a un dispositivo, Gladys usa primero el **local** (MQTT,
luego el Bridge) y recurre al otro si falla. Desactive **Preferir la conexión local** en la
configuración para usar primero Nuki Web. La insignia de cada dispositivo indica el canal
en uso: _Local_, _Nube_ o _Inaccesible_; un punto naranja indica un modo de respaldo (por
ejemplo: Bridge sin conexión, se usa Nuki Web).

## Instalación

### Nuki Bridge (local)

1. En la **app Nuki**, abra _Gestionar Bridge_ y active la **API HTTP**.
2. En Gladys, abra la configuración de la integración Nuki y haga clic en **Buscar mi
   Bridge**: la dirección IP se rellena sola (o introdúzcala, aparece en la app Nuki).
3. Haga clic en **Emparejar el Bridge** y **pulse el botón del Bridge** en menos de 30
   segundos: el token de la API se guarda automáticamente. También puede copiar el token
   que muestra la app.
4. Deje activado **Enviar el token con hash (seguro)** (firmware del Bridge 1.13 o posterior): el
   token nunca viaja en claro por su red.

> Asigne una IP fija al Bridge en su router: si cambia, vuelva a usar **Buscar mi Bridge**.

### MQTT (local, Smart Lock 3.0 Pro / 4.0 / Ultra)

1. Necesita un broker MQTT (Mosquitto…). Sirve el de la integración MQTT de Gladys.
2. En la **app Nuki**, abra los ajustes de la cerradura → _Funciones y configuración_ →
   **MQTT**, actívelo e indique la **dirección IP** del broker, el puerto, el usuario y la
   contraseña.
3. En Gladys, rellene **URL del broker MQTT** (p. ej. `mqtt://192.168.1.10:1883`), el
   usuario y la contraseña. Las cerraduras aparecen en unos segundos.

### Nuki Web (nube)

1. Active **Nuki Web** para sus dispositivos en la app Nuki.
2. En [web.nuki.io](https://web.nuki.io/), abra **API** y genere un **token de API** con al
   menos los permisos _Smartlock_, _Smartlock action_ y _Smartlock log_.
3. Péguelo en **Token de la API Nuki Web**.

### Crear los dispositivos

Abra la pestaña **Descubrimiento** de la integración y cree los dispositivos que desee. Si
más adelante empareja un sensor de puerta o un teclado, la pestaña ofrece actualizar el
dispositivo.

## Opciones

- **Intervalo de actualización**: frecuencia de lectura del Bridge (10 s como mínimo, 30 s
  por defecto). Nuki Web se lee como mucho cada 30 segundos y solo cuando hace falta. MQTT
  no necesita sondeo.
- **Cuando Gladys desbloquea**: _Solo desbloquear_ (por defecto) o _Desbloquear y abrir la
  puerta_.
- **Cuando Gladys bloquea**: _Bloquear_ (por defecto) o _Bloqueo completo_ (dos vueltas,
  Smart Lock 3.0 y posteriores; bloqueo simple en modelos anteriores).

## Dispositivos y funciones

**Smart Lock / Smart Door**

| Función                   | Descripción                                                |
| ------------------------- | ---------------------------------------------------------- |
| Cerradura                 | Interruptor: 1 = bloqueada, 0 = desbloqueada (controlable) |
| Estado de la cerradura    | Bloqueada / desbloqueada / en movimiento / error           |
| Batería                   | Nivel de carga en %                                        |
| Batería baja              | Alerta de batería crítica                                  |
| Cargando                  | Carga del Power Pack (3.0 y posteriores)                   |
| Puerta                    | Abierta / cerrada (si hay un sensor de puerta emparejado)  |
| Pila del sensor de puerta | (si hay un sensor de puerta emparejado)                    |
| Pila del teclado          | (si hay un teclado emparejado)                             |

**Opener**: interruptores _Ring to Open_ y _Modo continuo_, _Batería baja_ y _Timbre_
(detección de llamada, mediante el Bridge).

## Escenas

### Disparadores

- **Cerradura Nuki accionada** — una cerradura se bloqueó, desbloqueó, abrió o usó Lock 'n'
  Go. Filtre por cerradura, operación, **cómo** se accionó (app, a mano, botón, teclado,
  huella, bloqueo automático, Nuki Web, HomeKit, MQTT, Gladys…) y por el **usuario Nuki**
  (con Nuki Web). Variables: `action`, `trigger`, `user`, `device_name`.
  _Ejemplo: «cuando Alice desbloquea la puerta principal con el teclado, desactivar la
  alarma»._
- **Nuki Opener: han llamado al timbre** — alguien llamó al portero (Opener con Bridge).
- **Problema de cerradura Nuki** — motor bloqueado, cerradura sin calibrar u orden rechazada.
- **Batería Nuki crítica** — la batería de una cerradura, un Opener, un teclado o un sensor
  de puerta está baja.

Las operaciones iniciadas por la propia Gladys se indican con el disparador `gladys`:
exclúyalo en el filtro para que una escena no reaccione a sus propias acciones.

### Acciones

- **Accionar una cerradura Nuki** — bloquear, desbloquear, abrir la puerta, Lock 'n' Go,
  bloqueo completo. Salida: `success`.
- **Accionar un Nuki Opener** — abrepuertas, activar/desactivar Ring to Open o el modo
  continuo. Salida: `success`.
- **Leer un dispositivo Nuki** — salidas `locked`, `state`, `door_open`, `battery`,
  `battery_critical`, `reachable`, para las acciones siguientes (p. ej. enviar «la puerta
  sigue desbloqueada»).
- **Bloquear todas las cerraduras Nuki** — salidas `locked_count` y `failed_count`.

El disparador estándar «estado de un dispositivo» de Gladys también funciona con cada
función (puerta abierta, batería por debajo del 20 %…).

## Widgets del panel

- **Cerradura Nuki** — una cerradura u Opener: estado, batería en directo, puerta,
  accesorios, canal, última actividad y botones _Bloquear_ / _Desbloquear_ / _Abrir la
  puerta_ (la apertura pide confirmación). Para un Opener: _Abrir_ y _Ring to Open_.
- **Resumen Nuki** — todos los dispositivos Nuki de un vistazo y un botón **Bloquear todo**.
- **Actividad Nuki** — las últimas operaciones: quién, cómo y cuándo (desde Nuki Web si está
  configurado; si no, desde lo que observó la integración).

## Solución de problemas

- **«The Nuki Bridge refused the API token»**: vuelva a emparejar el Bridge o desactive
  _Enviar el token con hash (seguro)_ si el firmware de su Bridge es anterior a 1.13.
- **«Nuki Bridge unreachable»**: compruebe la dirección IP y que la API HTTP está activada.
  El Bridge atiende una petición cada vez: evite que otro programa lo consulte demasiado.
- **MQTT: no aparece ninguna cerradura**: compruebe en la app Nuki que MQTT está conectado,
  que la cerradura usa la **dirección IP** del broker y que Gladys usa el mismo broker.
- **Sin nombre de usuario en los disparadores**: los nombres vienen de Nuki Web; añada un
  token de API.
- El botón **Probar la conexión** comprueba cada canal configurado e indica qué funciona.

## Privacidad y seguridad

Los tokens y contraseñas los guarda Gladys como secretos y nunca se escriben en los
registros. El token del Bridge se envía con hash por defecto. Solo se contacta con Nuki Web
si configura un token de API. El historial de actividad se guarda en el volumen de datos
propio de la integración.
