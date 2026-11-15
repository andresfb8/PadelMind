# Padel Mind & Match Analyzer — Diseño del MVP

Fecha: 2026-11-15
Estado: pendiente de revisión por el usuario

## 1. Objetivo

Una PWA para que un entrenador de pádel registre, a pie de pista o desde vídeo, cómo gana y pierde los puntos su pareja y qué emociones muestran sus jugadores, y obtenga al terminar un informe con momentum, rendimiento bajo presión, síndrome de cierre, resiliencia y efecto de las emociones.

**Condición que manda sobre todo lo demás:** la app tiene que abrirse y registrar un partido entero en un iPhone sin cobertura, sin perder ningún punto.

### Usuario y contexto de uso

- Hoy: un solo entrenador (el autor). A futuro: producto para otros entrenadores. Por eso todos los datos cuelgan de la cuenta del entrenador desde el primer día.
- Dispositivo: iPhone o iPad, en vertical, con una mano.
- Dos formas de registrar sobre los mismos datos: **en directo** (solo, mirando la pista) y **desde vídeo** (con pausa). Un partido registrado en directo se puede completar después.
- Solo se detalla la pareja del entrenador. De los rivales solo se anota cómo ganan el punto.

## 2. Cambios respecto al PRD original

| PRD | Diseño |
|---|---|
| Next.js con servidor | App renderizada en cliente con Vite |
| Cola propia en IndexedDB | Caché persistente del SDK de Firestore |
| Modal emocional de 3 s tras cada punto | Botón "Emoción" siempre visible |
| `emotional_tag` como array en el punto | Emociones como registros propios, ligados a un punto y a un jugador |
| Detalle de ambas parejas | Solo la pareja propia |
| Zona en directo | Zona solo en modo vídeo o en revisión |
| `score_context` y `pressure_level` guardados | Calculados a partir de la lista de puntos |
| Jugadores como nombres dentro del partido | Jugadores y parejas como entidades |
| Sin saque ni formato | La app lleva el saque por pareja; formato configurable por partido |

## 3. Stack

- React + TypeScript (estricto) + Vite.
- Tailwind CSS. Solo tema oscuro, alto contraste.
- `vite-plugin-pwa` para precachear todo el código de la app e instalarla en la pantalla de inicio.
- Firebase: Firestore con caché local persistente y Firebase Auth con Google.
- Recharts para el gráfico de momentum.
- Vitest para pruebas.
- Vercel, con despliegue desde GitHub.

## 4. Modelo de datos

Rutas de Firestore:

```
coaches/{uid}
coaches/{uid}/players/{playerId}
coaches/{uid}/pairs/{pairId}
coaches/{uid}/matches/{matchId}
coaches/{uid}/matches/{matchId}/points/{pointId}
coaches/{uid}/matches/{matchId}/emotions/{emotionId}
```

Todos los identificadores se generan en el cliente, para poder crear documentos sin conexión.

```ts
type Player = { id: string; name: string; side: 'derecha' | 'reves' | null; createdAt: Timestamp };

type Pair = { id: string; playerIds: [string, string]; createdAt: Timestamp };

type MatchFormat = {
  deuce: 'punto_de_oro' | 'ventajas';
  finalSet: 'set_completo' | 'super_tiebreak';
};

type Match = {
  id: string;
  date: Timestamp;
  pairId: string;
  playerIds: [string, string];      // copia, para consultas por jugador
  leftPlayerId: string;             // qué jugador ocupa la columna izquierda
  opponentsName: string;
  format: MatchFormat;
  firstServer: 'us' | 'them';
  mode: 'directo' | 'video';        // solo afecta a la interfaz; se puede cambiar
  status: 'in_progress' | 'completed';
  createdAt: Timestamp;
};

type Outcome =
  | 'winner_nuestro'
  | 'error_rival'
  | 'no_forzado_nuestro'
  | 'forzado_nuestro'
  | 'winner_rival'
  | 'nuestro_sin_detalle'           // punto nuestro, causa no vista
  | 'rival_sin_detalle';            // punto del rival, causa no vista

type Shot = 'derecha' | 'reves' | 'volea' | 'bandeja_vibora' | 'remate' | 'globo' | 'saque_resto';
type Zone = 'fondo' | 'red';

type Point = {
  id: string;
  order: number;                    // orden cronológico; ver "Orden de los puntos"
  timestamp: Timestamp;             // hora real del registro
  outcome: Outcome;
  playerId: string | null;          // obligatorio en winner/no forzado/forzado nuestro; null en los de rival
  shot: Shot | null;
  zone: Zone | null;
};

type EmotionTag =
  | 'frustracion' | 'enfado_companero' | 'desconexion'
  | 'nervios' | 'miedo_a_fallar' | 'distraccion_externa'
  | 'euforia' | 'confianza' | 'apoyo_companero';

type Emotion = {
  id: string;
  playerId: string;
  tag: EmotionTag;
  afterPointId: string | null;      // punto tras el que se anotó; null si fue antes del primer punto
  timestamp: Timestamp;
};
```

Etiquetas negativas: `frustracion`, `enfado_companero`, `desconexion`, `nervios`, `miedo_a_fallar`, `distraccion_externa`. Positivas: `euforia`, `confianza`, `apoyo_companero`.

Quién gana el punto se deriva del resultado: `winner_nuestro`, `error_rival` y `nuestro_sin_detalle` son puntos nuestros; los otros cuatro, del rival.

Los dos resultados "sin detalle" existen porque, en directo y solo, a veces no se ve cómo acaba un punto. Cuentan para el marcador, el momentum y la presión, pero no para winners ni errores. En la revisión se pueden convertir en un resultado concreto.

`timestamp` solo equivale a la hora de juego en modo directo; en modo vídeo y en puntos insertados es la hora en que se registró.

### Orden de los puntos

`order` es un número. Al registrar, vale el `order` del último punto más 1. Al insertar un punto olvidado entre dos existentes en la revisión, vale la media de sus vecinos. Así insertar no obliga a reescribir los demás puntos.

Las emociones apuntan al punto por su identificador, no por su posición, de modo que insertar o borrar puntos no las descoloca. Al borrar un punto se borran las emociones que apuntan a él.

### Reglas de seguridad

Solo el usuario autenticado cuyo `uid` coincide con `{uid}` puede leer y escribir bajo `coaches/{uid}`. Todo lo demás, denegado. Las reglas se versionan en el repositorio y se prueban con el emulador de Firestore.

## 5. Motor de marcador

Función pura, sin dependencias:

```ts
computeMatchState(points: Point[], format: MatchFormat, firstServer: 'us' | 'them'): MatchState
```

`points` llega ordenado por `order`. Devuelve el estado final y una lista con el contexto de cada punto **antes de jugarse**:

```ts
type PointContext = {
  pointId: string;
  setIndex: number;
  gamesUs: number; gamesThem: number;
  scoreLabel: string;               // "30-40", "Punto de oro", "Ventaja nosotros", "5-4" en tie-break
  server: 'us' | 'them';
  isTiebreak: boolean;
  isGoldenPoint: boolean;
  isBreakPoint: 'us' | 'them' | null;   // quién tiene la bola de break
  isSetPoint: 'us' | 'them' | null;
  isMatchPoint: 'us' | 'them' | null;
  servingForSet: 'us' | 'them' | null;  // el sacador gana el set si gana este juego
  wonBy: 'us' | 'them';
};
```

Reglas:

- Juego: 0, 15, 30, 40. Con `punto_de_oro`, en 40-40 el siguiente punto decide. Con `ventajas`, hay que ganar por dos.
- Set: a 6 juegos con dos de diferencia; con 6-6, tie-break a 7 con dos de diferencia.
- Partido: al mejor de 3 sets. Con `super_tiebreak`, si los sets van 1-1 el tercero es un tie-break a 10 con dos de diferencia.
- Saque: alterna cada juego. En tie-break y súper tie-break saca un punto la pareja a la que le toca y después se alterna cada dos puntos. La pareja que sacó primero en el tie-break resta en el primer juego del set siguiente.
- `servingForSet`: la pareja que saca tiene 5 juegos y la otra 4 o menos, o tiene 6 y la otra 5.
- En tie-break no hay bola de break ni `servingForSet`; sí bola de set y de partido.
- Los puntos registrados después de terminado el partido se ignoran y se señalan como sobrantes.

Deshacer consiste en borrar el último punto; el estado se recalcula entero. Con los 150–250 puntos de un partido el recálculo es inmediato.

## 6. Analítica

Funciones puras que reciben puntos, contextos y emociones. Toda cifra se devuelve con su número de casos (`{ won, total }`); con `total` igual a 0 la interfaz muestra "sin datos suficientes".

- **Momentum.** Serie acumulada: +1 si el punto es nuestro, −1 si es del rival. Eje X: puntos, con separadores de juego y de set. Marcas: puntos de oro, breaks conseguidos o sufridos y emociones (color según sean negativas o positivas).
- **Resumen técnico.** Por jugador: winners, no forzados, forzados y balance (winners − no forzados). Desglose por golpe de los puntos con golpe anotado.
- **Bajo presión.** Puntos de oro ganados sobre jugados; bolas de break convertidas; bolas de break salvadas.
- **Síndrome de cierre.** Porcentaje de puntos ganados en los juegos en que nuestra pareja saca para cerrar el set (`servingForSet === 'us'`), frente al porcentaje en el resto de puntos del partido.
- **Resiliencia.** Por jugador: de los puntos jugados inmediatamente después de un no forzado suyo, porcentaje ganado por la pareja. Solo cuenta el punto siguiente dentro del mismo set.
- **Efecto de las emociones.** Por cada emoción: puntos ganados por la pareja en los 5 puntos siguientes a `afterPointId` (la ventana se corta al acabar el set) y no forzados de ese jugador en la ventana. Resumen por jugador y etiqueta: porcentaje ganado tras la etiqueta frente al porcentaje del partido. El tamaño de la ventana es una constante.

## 7. Pantallas

| Pantalla | Contenido |
|---|---|
| Acceso | Entrar con Google |
| Inicio | Partidos en curso y terminados; "Nuevo partido"; acceso a Jugadores |
| Jugadores | Crear y editar jugadores y parejas |
| Nuevo partido | Pareja, nombre de rivales, formato, quién saca primero, modo |
| Registro | Pantalla de pista |
| Revisión | Lista de puntos para completar y corregir |
| Informe | Los seis bloques y "Compartir" |

### Registro

Disposición elegida ("por jugador"), de arriba abajo:

1. Marcador: sets, juegos y puntos de ambas parejas, indicador de saque, etiqueta de situación (bola de break, punto de oro, bola de set, bola de partido).
2. Indicador de sincronización: "todo guardado" o "N puntos sin sincronizar".
3. Zona libre (fuera del alcance del pulgar); aquí aparece la fila de golpes.
4. Dos columnas, una por jugador, con tres botones cada una: Winner, No forzado, Forzado. La columna izquierda es `leftPlayerId`; un botón intercambia las columnas.
5. Fila de rivales: Error rival, Winner rival.
6. Fila estrecha "no lo he visto": Punto nuestro, Punto rival (registran `nuestro_sin_detalle` y `rival_sin_detalle`).
7. Fila fija: Deshacer, Emoción.

Comportamiento:

- Un toque registra el punto, lo escribe en local y actualiza el marcador. Confirmación visual (destello del botón y del marcador). iOS no ofrece vibración a las webs, así que no se depende de ella.
- Tras un punto de la pareja propia aparece la fila de golpes. En modo `directo` dura 4 segundos o hasta el siguiente punto, y no bloquea los botones. En modo `video` se muestran golpe y zona, y permanecen hasta el siguiente punto.
- Error rival y Winner rival no preguntan nada más.
- Deshacer borra el último punto y sus emociones; se puede repetir.
- Emoción abre un panel inferior: jugador (dos botones) y rejilla 3×3 de etiquetas. Se guarda ligada al último punto registrado y se cierra.
- La pantalla se mantiene encendida (Wake Lock) mientras el registro está abierto.
- Al terminar el partido, la app propone cerrarlo y abrir el informe. Además hay una acción "Finalizar partido" en el menú de la pantalla, para partidos que se interrumpen o que no se registran enteros.
- El informe se puede abrir en cualquier momento, también con el partido sin terminar.
- Si se cierra la app a mitad, el partido se reabre donde estaba.

### Revisión

Los datos del partido (formato, quién saca primero, nombre de rivales) se pueden corregir después; como todo se calcula, el marcador se rehace solo.

Una fila por punto: marcador previo, resultado, jugador, golpe, zona y emociones; los campos vacíos se destacan. Al tocar una fila se puede editar cualquier campo, añadir o quitar emociones, insertar un punto antes o después y borrar el punto. Todo se recalcula.

### Informe

Página única, en este orden: Momentum, Resumen técnico, Bajo presión, Síndrome de cierre, Resiliencia, Efecto de las emociones. Botón "Compartir informe": genera una imagen PNG del informe y abre el menú de compartir del sistema (Web Share con archivos). Si no está disponible, descarga la imagen. El PDF queda fuera del MVP.

## 8. Sin conexión y sincronización

- El código de la app se precachea; se abre sin red una vez instalada.
- Firestore se inicializa con caché local persistente. Las escrituras se aplican en local al momento y suben cuando hay red.
- El indicador de sincronización se basa en las escrituras pendientes que informa el SDK.
- iOS no sincroniza con la app cerrada: lo pendiente sube al reabrirla con conexión.
- Firestore solo guarda en caché lo que se ha leído. Por eso, al arrancar, la app se suscribe a jugadores, parejas y lista de partidos; así se puede crear un partido sin conexión con los datos de la última sesión con red.
- La interfaz nunca espera a que una escritura termine: sin red, la promesa de escritura no se resuelve hasta que vuelve la conexión. La pantalla se actualiza desde la copia local.
- Deshacer (el punto y sus emociones) se hace en un lote de escrituras, no en una transacción, porque las transacciones no funcionan sin conexión.
- La primera vez hace falta red para iniciar sesión.

## 9. Errores

- Escritura rechazada por el servidor (no por falta de red): Firestore revierte el cambio en local, así que el punto desaparecería. La app captura el rechazo y muestra un aviso persistente con los datos del punto para volver a registrarlo. Si la app se reinició antes de sincronizar, el rechazo no se puede capturar; el riesgo es bajo porque las reglas solo dependen de la cuenta, y se cubre con las pruebas de reglas.
- Sesión caducada sin red: se sigue registrando con la sesión guardada.
- Métrica sin casos: "sin datos suficientes".
- Puntos sobrantes tras el final del partido: se señalan en la revisión.

## 10. Pruebas

- **Motor de marcador:** pruebas unitarias exhaustivas, escritas antes que el código. Punto de oro, ventajas, tie-break, súper tie-break, rotación del saque incluido el cambio tras tie-break, bolas de break, set y partido, `servingForSet`, puntos sobrantes.
- **Analítica:** pruebas unitarias con partidos de ejemplo cuyo resultado se conoce de antemano, incluidas ventanas de emoción cortadas por fin de set.
- **Reglas de seguridad:** pruebas con el emulador.
- **Pantallas:** prueba manual en iPhone real.

## 11. Orden de construcción

1. **Registro en directo.** Proyecto base y PWA, acceso, motor de marcador, jugadores y parejas, nuevo partido, pantalla de registro, deshacer, emociones, sin conexión, reglas de seguridad.
2. **Informe.** Analítica, los seis bloques, exportación.
3. **Vídeo y revisión.** Modo vídeo y pantalla de revisión.

Tras el tramo 1 la app ya sirve para registrar un partido real.

## 12. Comprobaciones tempranas en iPhone real

No se dan por hechas; se prueban en el tramo indicado y, si fallan, se replantea esa pieza:

- (Tramo 1, lo primero) Iniciar sesión con Google desde la app instalada en la pantalla de inicio, alojada en Vercel. En iOS el acceso con Google puede fallar en apps instaladas cuando el dominio de autenticación no es el de la app. Se configura el dominio de autenticación en el mismo dominio que la app; alternativa si falla: acceso con correo y contraseña.
- (Tramo 1) La caché de Firestore, con puntos sin sincronizar, sobrevive varios días sin abrir la app instalada.
- (Tramo 1) Wake Lock mantiene la pantalla encendida en la app instalada.
- (Tramo 2) Compartir un archivo a WhatsApp desde la app instalada. Alternativa: descarga y adjuntar a mano.

## 13. Supuestos

- Vite en lugar de Next (el usuario no indicó preferencia).
- Se añaden dos botones "no lo he visto" que no estaban en el boceto aprobado.
- La confirmación del punto es visual, no por vibración.
- La resiliencia mide solo el punto siguiente a un no forzado; lo que ocurre tras una emoción negativa se ve en "Efecto de las emociones".
- La app lleva el saque por pareja (el usuario no respondió expresamente).
- Exportación como imagen; PDF y enlace de solo lectura quedan fuera.
- Los partidos pueden completarse desde otro dispositivo.
- El vídeo se ve fuera de la app.

## 14. Fuera del MVP

Estadísticas acumuladas por jugador y pareja, exportación en PDF, enlace de solo lectura, vídeo dentro de la app y sincronización con vídeo, cuentas de otros entrenadores, estadísticas detalladas de rivales, saque por jugador individual, edición de la lista de etiquetas o golpes desde la app.
