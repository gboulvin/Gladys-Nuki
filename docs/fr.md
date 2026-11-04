# Nuki pour Gladys Assistant

Pilotez vos appareils **Nuki** depuis Gladys : Smart Lock (toutes générations, 3.0 Pro,
4e génération, Ultra), Smart Door et Opener — verrouiller, déverrouiller, ouvrir la porte,
suivre les batteries, le capteur de porte et le clavier, et réagir à chaque opération dans
vos scènes.

## Choisir comment Gladys parle à vos appareils Nuki

L'intégration propose trois canaux. Configurez-en **au moins un** ; vous pouvez les combiner.

| Canal           | Type               | Appareils                                       | Ce qu'il apporte                                                             |
| --------------- | ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| **Nuki Bridge** | Local (HTTP)       | Toutes les Smart Lock, Smart Door et Opener     | Fonctionne sans internet, détection de sonnerie de l'Opener                  |
| **MQTT**        | Local (temps réel) | Smart Lock 3.0 Pro, 4e génération, Ultra        | Mises à jour instantanées sans interrogation, qui/comment (bouton, clavier…) |
| **Nuki Web**    | Cloud              | Tous les appareils liés à votre compte Nuki Web | Qui a actionné la serrure (nom, clavier, empreinte), journal d'activité      |

Quand plusieurs canaux atteignent un appareil, Gladys utilise d'abord le **local** (MQTT,
puis le Bridge) et bascule sur l'autre en cas d'échec. Désactivez **Préférer la connexion
locale** dans l'écran de configuration pour passer d'abord par Nuki Web. Le badge de chaque
appareil indique le canal utilisé : _Locale_, _Cloud_ ou _Injoignable_ ; un point orange
signale un mode de secours (par exemple : Bridge hors ligne, Nuki Web utilisé à la place).

## Installation

### Nuki Bridge (local)

1. Dans l'**app Nuki**, ouvrez _Gérer le Bridge_ et activez l'**API HTTP**.
2. Dans Gladys, ouvrez la configuration de l'intégration Nuki et cliquez sur **Trouver mon
   Bridge** : l'adresse IP est remplie pour vous (ou saisissez-la, elle est affichée dans
   l'app Nuki).
3. Cliquez sur **Appairer le Bridge**, puis **appuyez sur le bouton du Bridge** dans les
   30 secondes : le jeton d'API est enregistré automatiquement. Vous pouvez aussi recopier
   le jeton affiché dans l'app.
4. Laissez **Envoyer le jeton haché (sécurisé)** activé (firmware du Bridge 1.13 ou plus) : le jeton
   ne circule jamais en clair sur votre réseau.

> Donnez une adresse IP fixe au Bridge dans votre box : si elle change, relancez **Trouver
> mon Bridge**.

### MQTT (local, Smart Lock 3.0 Pro / 4.0 / Ultra)

1. Il vous faut un broker MQTT (Mosquitto…). Celui de l'intégration MQTT de Gladys convient.
2. Dans l'**app Nuki**, ouvrez les réglages de la serrure → _Fonctionnalités et
   configuration_ → **MQTT**, activez-le et indiquez l'**adresse IP** du broker, le port,
   l'utilisateur et le mot de passe.
3. Dans Gladys, renseignez **URL du broker MQTT** (ex. `mqtt://192.168.1.10:1883`),
   l'utilisateur et le mot de passe. Les serrures apparaissent en quelques secondes.

### Nuki Web (cloud)

1. Activez **Nuki Web** pour vos appareils dans l'app Nuki.
2. Sur [web.nuki.io](https://web.nuki.io/), ouvrez **API** et générez un **jeton d'API**
   avec au moins les droits _Smartlock_, _Smartlock action_ et _Smartlock log_.
3. Collez-le dans **Jeton d'API Nuki Web**.

### Créer les appareils

Ouvrez l'onglet **Découverte** de l'intégration et créez les appareils souhaités. Si vous
ajoutez plus tard un capteur de porte ou un clavier, l'onglet Découverte propose de mettre
l'appareil à jour.

## Options

- **Intervalle de rafraîchissement** : fréquence de lecture du Bridge (10 s minimum, 30 s
  par défaut). Nuki Web est lu au plus toutes les 30 secondes, et seulement si nécessaire.
  MQTT n'a pas besoin d'interrogation.
- **Quand Gladys déverrouille** : _Déverrouiller seulement_ (par défaut) ou _Déverrouiller
  et ouvrir la porte_.
- **Quand Gladys verrouille** : _Verrouiller_ (par défaut) ou _Verrouillage complet_ (deux
  tours, Smart Lock 3.0 et plus ; verrouillage simple sur les modèles plus anciens).

## Appareils et fonctionnalités

**Smart Lock / Smart Door**

| Fonctionnalité           | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| Serrure                  | Interrupteur : 1 = verrouillée, 0 = déverrouillée (pilotable) |
| État de la serrure       | Verrouillée / déverrouillée / en mouvement / erreur           |
| Batterie                 | Niveau de charge en %                                         |
| Batterie faible          | Alerte batterie critique                                      |
| En charge                | Charge du Power Pack (3.0 et plus)                            |
| Porte                    | Ouverte / fermée (si un capteur de porte est appairé)         |
| Pile du capteur de porte | (si un capteur de porte est appairé)                          |
| Pile du clavier          | (si un clavier est appairé)                                   |

**Opener** : interrupteurs _Ring to Open_ et _Mode continu_, _Batterie faible_, et
_Sonnette_ (détection de sonnerie, via le Bridge).

## Scènes

### Déclencheurs

- **Serrure Nuki actionnée** — une serrure a été verrouillée, déverrouillée, ouverte ou a
  utilisé Lock 'n' Go. Filtrez sur la serrure, l'opération, **comment** elle a été actionnée
  (app, à la main, bouton, clavier, empreinte, verrouillage auto, Nuki Web, HomeKit, MQTT,
  Gladys…) et l'**utilisateur Nuki** (avec Nuki Web). Variables : `action`, `trigger`,
  `user`, `device_name`.
  _Exemple : « quand Alice déverrouille la porte d'entrée avec le clavier, couper l'alarme »._
- **Nuki Opener : on a sonné** — quelqu'un a sonné à l'interphone (Opener avec Bridge).
- **Problème de serrure Nuki** — moteur bloqué, serrure non calibrée ou commande refusée.
- **Batterie Nuki critique** — la batterie d'une serrure, d'un Opener, d'un clavier ou d'un
  capteur de porte est faible.

Les opérations lancées par Gladys elle-même sont signalées avec le déclencheur `gladys` :
excluez-le dans le filtre pour qu'une scène ne réagisse pas à ses propres actions.

### Actions

- **Actionner une serrure Nuki** — verrouiller, déverrouiller, ouvrir la porte, Lock 'n' Go,
  verrouillage complet. Sortie : `success`.
- **Actionner un Nuki Opener** — ouvrir la gâche, activer/désactiver Ring to Open ou le mode
  continu. Sortie : `success`.
- **Lire un appareil Nuki** — sorties `locked`, `state`, `door_open`, `battery`,
  `battery_critical`, `reachable`, utilisables dans les actions suivantes (ex. envoyer
  « la porte est toujours déverrouillée »).
- **Verrouiller toutes les serrures Nuki** — sorties `locked_count` et `failed_count`.

Le déclencheur standard « état d'un appareil » de Gladys fonctionne aussi sur chaque
fonctionnalité (porte ouverte, batterie sous 20 %…).

## Widgets du tableau de bord

- **Serrure Nuki** — une serrure ou un Opener : état, batterie en direct, porte,
  accessoires, canal, dernière activité, et boutons _Verrouiller_ / _Déverrouiller_ /
  _Ouvrir la porte_ (l'ouverture demande confirmation). Pour un Opener : _Ouvrir_ et
  _Ring to Open_.
- **Vue d'ensemble Nuki** — tous les appareils Nuki d'un coup d'œil et un bouton **Tout
  verrouiller**.
- **Activité Nuki** — les dernières opérations : qui, comment et quand (depuis Nuki Web si
  configuré, sinon depuis ce que l'intégration a observé).

## Dépannage

- **« The Nuki Bridge refused the API token »** : appairez de nouveau le Bridge, ou
  désactivez _Envoyer le jeton haché (sécurisé)_ si le firmware de votre Bridge est antérieur à 1.13.
- **« Nuki Bridge unreachable »** : vérifiez l'adresse IP et que l'API HTTP est activée. Le
  Bridge traite une requête à la fois : évitez qu'un autre logiciel l'interroge trop souvent.
- **MQTT : aucune serrure n'apparaît** : vérifiez dans l'app Nuki que MQTT est connecté, que
  la serrure utilise l'**adresse IP** du broker, et que Gladys utilise le même broker.
- **Pas de nom d'utilisateur dans les déclencheurs** : les noms viennent de Nuki Web ;
  ajoutez un jeton d'API.
- Le bouton **Tester la connexion** vérifie chaque canal configuré et indique ce qui
  fonctionne.

## Confidentialité et sécurité

Les jetons et mots de passe sont stockés par Gladys comme secrets et jamais écrits dans les
logs. Le jeton du Bridge est envoyé haché par défaut. Nuki Web n'est contacté que si vous
configurez un jeton d'API. L'historique d'activité est conservé dans le volume de données
propre à l'intégration.
