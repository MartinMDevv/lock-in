# Hoja de ruta

El plan de trabajo completo hasta la v1, fase por fase, con su avance real.
Es **el único lugar** donde viven las fases: el *qué* y el *por qué* del
proyecto están en [`PLAN.md`](PLAN.md), el esquema en
[`MODELO_DATOS.md`](MODELO_DATOS.md) y los motivos en
[`DECISIONES.md`](DECISIONES.md).

## Cómo leer esta hoja

| Símbolo | Significado |
|:---:|---|
| ✅ | Hecho y verificado |
| 🚧 | En curso, o escrito pero sin verificar |
| ⬜ | Pendiente |
| 🔴 | **Bloqueante**: lo que viene después no se puede hacer sin esto |
| 🟡 | Importante, pero no traba a nadie |
| 🟢 | Puede esperar |

Dos reglas:

1. **Una tarea se marca ✅ solo cuando funciona en el teléfono**, no cuando el
   código compila.
2. **Cada fase tiene un «Termina cuando».** Si eso no se cumple, la fase no
   está cerrada, aunque todas sus casillas estén marcadas.

## Estado general (28-oct-2026)

| Fase | Qué deja lista | Avance |
|---|---|---|
| **F0 · Cimientos y esqueleto** | Arranca, se verifica sola, está publicada y se navega | ✅ cerrada el 28-oct-2026 |
| **F1 · Base de datos definitiva** | Las 15 tablas en producción, con RLS probada | ✅ cerrada el 28-oct-2026: 7 migraciones, *Advisors* limpio, RLS 127/127 y primer respaldo |
| **F2 · El diseño en el código** | La app se ve como el prototipo | ⬜ |
| **F3 · Una cosa útil por área** | Se puede vivir un día dentro de la app | ⬜ |
| **F4 · PWA y uso de prueba** | Instalada y usada dos semanas | ⬜ |
| **F5 · Sincronía y sin conexión** | Anotar sin señal sin duplicar nada | ⬜ |
| **F6 · Importar y exportar** | Un mes de gastos desde un CSV en un minuto | ⬜ |
| **F7 · Seguridad** | Una cuenta no ve nada de otra, probado en CI | ⬜ (empieza en F1) |
| **F8 · Profundidad** | Lo que pida el uso real | ⬜ |
| **F9 · Notificaciones** | Prueba de concepto | ⬜ opcional |
| **F10 · Revisión** | Arquitectura y buenas prácticas revisadas | ⬜ |
| **F11 · Publicación del servicio** | Cualquiera entra con Google y la usa sin preguntar | ⬜ |
| **F12 · Prueba final** | `v1.0.0` | ⬜ |

### El orden, y por qué

```
F0 ─► F1 Base ─► F2 Diseño ─► F3 Áreas útiles ─► F4 PWA y uso ─► F5 Sin conexión
        │                                              │
        └─► F7 Seguridad (empieza en F1, se cierra antes de F10)
                                                       ▼
                 F6 Importar/exportar ─► F8 Profundidad ─► F9 Notificaciones (opcional)
                                                       ▼
                                 F10 Revisión ─► F11 Publicación ─► F12 Prueba final
```

Pensado para que **nada se haga dos veces**. La base va primero porque todo la
pisa. La PWA va cuando ya hay algo que valga la pena instalar. Importar va
cuando el esquema ya no se mueve, y publicar va al final, con todo probado.

**A lo ancho primero, en profundidad después:** un módulo perfecto durante tres
semanas deja una app que todavía no es lo prometido, y a esa altura ya se
abandonó.

---

## F0 · Cimientos y esqueleto

Antes eran los Hitos 0 y 1.
*Termina cuando se entra desde el teléfono y se navegan las cinco áreas.*

| | Tarea | Detalle | Prio |
|:---:|---|---|:---:|
| ✅ | Andamiaje | Vite + TypeScript estricto + Tailwind v4 + oxlint | 🔴 |
| ✅ | Escáner de secretos | Gancho de pre-commit y paso de CI (D2) | 🔴 |
| ✅ | CI en runner propio | Solo con `push` (D15) | 🟡 |
| ✅ | Lógica del reparto | `core/money/allocate.ts` con 8 pruebas (D20) | 🟡 |
| ✅ | Supabase | Proyecto creado, CLI enlazado, `.env` cargado | 🔴 |
| ✅ | Deploy en Vercel | Cada push a `main` redespliega | 🔴 |
| ✅ | Migración `profiles` | Aplicada el 06-oct, al prender «Deploy to production» (D16) | 🔴 |
| ✅ | Regenerar tipos | `src/types/database.ts` ya trae `profiles` (14-oct) | 🔴 |
| ✅ | Login | Solo Google (D32). 28-oct: entra y vuelve bien en el escritorio y en el teléfono (Android, Chrome) | 🔴 |
| ✅ | Rutas y cáscara | Las seis rutas, barra inferior y menú lateral. Recorridas en el teléfono el 28-oct | 🔴 |
| ✅ | Pantalla por área y «Hoy» | Cada una con su estado vacío. Vistas en el teléfono el 28-oct | 🟡 |
| ✅ | Ajustes | Lee y guarda nombre, moneda, zona horaria, unidad de peso e inicio de semana (14-oct). El tema entra con la F1 | 🟡 |
| ✅ | Diseño | Exportado de Claude Design el 06-oct: grafito + acento lima, fuente Geist. El paquete vive fuera del repo | 🟡 |
| ✅ | Decisiones D24–D30 | Revisadas con el autor el 10-oct | 🔴 |
| ✅ | **Revisión en el teléfono** | 28-oct: entra con Google, recorre las 5 áreas y guarda en Ajustes | 🔴 |
| ✅ | **Apagar el proveedor Email** (D32) | 28-oct: apagado. El registro sigue abierto, solo por Google. «Allow new users to sign up» queda prendido a propósito | 🔴 |
| ✅ | Protección de Vercel | 28-oct: en incógnito, el dominio de producción abre directo el login de Lock In. La protección solo cubre las vistas previas, y así se queda | 🟡 |

## F1 · Base de datos definitiva

*Termina cuando las 15 tablas existen en producción, la prueba de RLS pasa y
hay un respaldo descargado.*

La base tiene una sola tabla. Es el último momento en que el esquema se puede
cambiar sin migrar datos de nadie, así que se deja **completo y probado antes
de cargar datos reales**.

- [x] Decidir D24–D30 (10-oct-2026).
- [x] Pasar el esquema definitivo a `MODELO_DATOS.md` (10-oct-2026).
- [x] Escribir las migraciones 1 a 6 de [`MODELO_DATOS.md`](MODELO_DATOS.md#las-migraciones-en-orden) (14-oct-2026; horario quedó antes que tareas), **una por commit**, revisando cada una dos veces antes del push: van directo a producción (D16, D27).
- [x] `npm run db:types` después de cada una.
- [x] **Prueba de RLS con dos cuentas** en producción (28-oct-2026): [`scripts/rls-check.sql`](../scripts/rls-check.sql) en el SQL Editor → **127 pruebas sobre 15 tablas, 0 fallas**. Crea dos cuentas ficticias y deshace todo al terminar. Comprueba también que la migración 7 no rompió el registro.
- [x] Revisar los avisos de seguridad y rendimiento de Supabase (*Advisors*) y dejarlos en cero. **28-oct: 0 errores, 0 sugerencias y 1 WARN aceptado** (abajo).
  - Revisión del 14-oct: **5 WARN de seguridad y 25 INFO**. Rendimiento sin
    avisos: ninguna llave foránea sin índice y ninguna política lenta.
  - 25 INFO `unused_index`: esperables con la base vacía. Se miran de nuevo
    tras dos semanas de uso (F4), no antes.
  - 4 WARN `security_definer_function_executable`: `anon` y `authenticated`
    pueden ejecutar `handle_new_user()` (nuestra) y `rls_auto_enable()` (la
    creó Supabase, no está en las migraciones). Las dos son funciones de
    trigger, que no se pueden llamar por RPC, así que el riesgo real es nulo,
    pero se cierra con una migración 7 que haga `revoke execute … from
    public, anon, authenticated`; la de `rls_auto_enable` con `if exists`,
    porque en otra instancia puede no estar.
  - 1 WARN `auth_leaked_password_protection`: **aceptado** (28-oct). Es solo
    para el plan Pro y no aplica: con el proveedor Email apagado (D32) no hay
    contraseñas que revisar.
- [x] **Migración 7** `revocar_execute_funciones` (28-oct-2026, `1f15bc5`): aplicada. *Advisors* confirmó que se fueron los 4 WARN de `security_definer_function_executable`.
- [x] **Primer respaldo** (28-oct-2026): con el `pg_dump` local (18.6, sirve contra el 17.6 de
  producción) en vez de `supabase db dump`, para no depender de Docker. Conexión directa por IPv6;
  la contraseña vive en `~/.pgpass` (600). Se guarda en `~/respaldos/lock-in/`, fuera del repo y de
  la bóveda: `*-esquema.sql` (solo `public`) y `*-datos.dump` (`-Fc`, `public.*` + `auth.users` +
  `auth.identities`; sin sesiones ni tokens). Ojo: `-t` anula `-n`, por eso las tablas de `public`
  van como `-t 'public.*'`. `envelopes` tiene una FK circular: al restaurar solo los datos hace
  falta `--disable-triggers`. Restauración todavía sin probar.

## F2 · El diseño en el código

*Termina cuando la app se ve como el prototipo en el teléfono **y** en el
escritorio, todavía sin datos.*

- [ ] Pegar `tokens/index.css` del paquete de diseño en `src/index.css`.
- [ ] Fuentes Geist y Geist Mono.
- [ ] Los 10 componentes base del diseño: botón, campo, chip, segmentado, hoja inferior, toast con Deshacer, esqueleto de carga…
- [ ] La cáscara: barra inferior con pastilla deslizante (< 1024 px) y menú lateral de 224 px (≥ 1024 px).
- [ ] Tema oscuro, claro o sistema, leyendo `profiles.theme`.
- [ ] **Pulir el tema claro**: hoy está menos trabajado que el oscuro.
- [ ] `prefers-reduced-motion`.

## F3 · Una cosa útil por área

Antes era el Hito 2.
*Termina cuando se puede vivir un día entero dentro de la app, y cada registro
toma menos de 5 segundos (medido con cronómetro, no estimado).*

- [ ] Ajustes: nombre, moneda, zona horaria y tema.
- [ ] Bienvenida con presets (sobres y rutinas), que **insertan filas**.
- [ ] Plata: registrar un gasto en **< 5 s** con el teclado propio; viene elegido el último sobre usado.
- [ ] Tareas: crear con Enter, completar con un toque, Deshacer.
- [ ] Horario: crear un bloque con sus horarios y uno de los 10 colores; vista día.
- [ ] Gimnasio: sesión activa y anotar una serie según cómo se mide el ejercicio, con la carga de la vez pasada a la vista.
- [ ] Archivar y desarchivar sobres, ejercicios y rutinas: **no tienen «Borrar»** (D30).
- [ ] Ctrl K en el escritorio, eligiendo el sobre a mano (D28).
- [ ] **Hoy con datos reales**, en el teléfono y en el escritorio.
- [ ] Estados vacío, cargando y error en cada área.

## F4 · PWA y uso de prueba

*Termina cuando la app se abrió a diario durante las dos semanas, o se entiende
por qué no.*

La PWA va aquí y no antes, a propósito: instalar una app que no hace nada es
una forma rápida de que se desinstale.

- [ ] Manifest, íconos (incluido el *maskable*) y color de tema.
- [ ] Service worker: cachea la cáscara y los recursos.
- [ ] Instalar en el teléfono y en el computador.
- [ ] **Dos semanas de uso real.** Anotar cada fricción en un issue, sin arreglar nada en el momento.
- [ ] Al final: recortar lo que no se usó. **Se recorta, nunca se agrega.**

## F5 · Sincronía y sin conexión

*Termina cuando las cuatro pruebas manuales pasan en el teléfono real.*

- [ ] Persistir la caché de TanStack Query en IndexedDB: la app abre con los últimos datos sin señal.
- [ ] Persistir las **creaciones** pendientes y reintentarlas al volver la señal, con el aviso «pendiente de sincronizar». Editar y borrar siguen pidiendo conexión (D24).
- [ ] Refrescar al volver a la pestaña; evaluar Supabase Realtime para que el computador vea al instante lo que se anotó en el teléfono.
- [ ] Pruebas manuales escritas, paso a paso:
  1. Registrar en el teléfono → aparece en el computador.
  2. Modo avión → abrir la app → se ven los datos.
  3. Modo avión → registrar un gasto → volver la señal → llega una sola vez.
  4. Cerrar la app con algo pendiente → reabrir con señal → se envía.

## F6 · Importar y exportar

*Termina cuando se carga un mes completo de gastos desde un CSV en menos de un
minuto, y exportar e importar devuelve lo mismo.*

- [ ] `docs/FORMATO_CSV.md`: una plantilla por área (columnas, tipos, ejemplos) **y un texto listo para pedírselo a una IA**: *«hazme un CSV con este formato con mis gastos de septiembre»*.
- [ ] El lector de CSV en `core/`, puro y con pruebas: valida cada fila con Zod y devuelve las válidas y los errores con su número de fila.
- [ ] Pantalla de importación: elegir área → subir → **vista previa** con errores → confirmar.
- [ ] Deshacer una importación desde Ajustes: borra su fila de `imports` y, con ella, solo lo que trajo.
- [ ] Exportar por área en el mismo formato, más el JSON completo (D25).
- [ ] Prueba de ida y vuelta: exportar → importar en una cuenta vacía → los datos son iguales.

## F7 · Seguridad y protección de datos

*Empieza en F1 y se cierra antes de F10.*
*Termina cuando la prueba de RLS corre en CI y pasa, y una persona con dos
cuentas no logra ver nada de la otra.*

- [ ] 🚧 **Prueba automatizada de RLS** con dos cuentas de prueba, para **cada tabla**: leer, insertar con un `user_id` ajeno, editar y borrar lo de otro → todo debe fallar. 28-oct: escrita (`scripts/rls-check.sql`) y pasada a mano en producción; falta que corra en el CI contra un Supabase local.
- [x] Ninguna tabla sin RLS ni sin `grant` explícito: lo revisa el bloque 1 de `scripts/rls-check.sql`, que además falla si aparece una tabla nueva sin cubrir.
- [ ] *Advisors* de Supabase en cero.
- [x] *Site URL* fijado al dominio de Vercel y registro abierto solo por Google (D32, 28-oct-2026).
- [ ] **Topes por cuenta**: con el registro abierto, que una sola cuenta no pueda llenar los 500 MB del plan.
- [x] Cabeceras de seguridad en `vercel.json`: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y anti-iframe (28-oct-2026, iguales a las de `docker/security-headers.conf`). Probado en producción: login con Google, Ajustes y guardar funcionan. Vercel agrega HSTS solo.
- [x] La caché de una cuenta se borra al cerrar sesión o al entrar otra (28-oct, `AuthProvider` + 3 pruebas).
- [ ] `npm audit` sin vulnerabilidades altas.
- [ ] **Borrar mi cuenta** desde Ajustes, con **doble confirmación** (D30): primero se ofrece exportar y se avisa qué se pierde, después se escribe «BORRAR».
- [ ] Que un CSV importado no pueda colar fórmulas al exportarlo (`=`, `+`, `-`, `@` al inicio de una celda).

## F8 · Profundidad, según el uso

Antes era el Hito 3.
**El orden lo decide lo que efectivamente se esté abriendo en F4**, no esta
lista. Nada de aquí es bloqueante: son mejoras a algo que ya funciona.

| | Tarea | Detalle | Prio |
|:---:|---|---|:---:|
| ⬜ | Reparto al ingresar plata | Las tres perillas del sobre en la interfaz | 🟡 |
| ⬜ | Topes con reinicio | Cuánto queda del período, calculado (D6) | 🟡 |
| ⬜ | Barrido de fin de mes | Pregunta una vez por sobre y mes, recuerda la respuesta en `period_closures` y se puede deshacer | 🟢 |
| ⬜ | Metas con ritmo | Cuánto falta y a qué ritmo (D21) | 🟢 |
| ⬜ | Rutinas y racha | Rutinas configurables; racha sobre los días que tocaba (D22) | 🟢 |
| ⬜ | **Dashboards con historial por mes** | Pedido del autor: en el gimnasio, peso y repeticiones del mes pasado contra este; en la plata, gastos de meses anteriores y los sobres archivados con el estado en que quedaron | 🟡 |
| ⬜ | Vista semana | El horario completo de un vistazo | 🟢 |
| ⬜ | Medidas corporales | Peso y medidas en el tiempo | 🟢 |
| ⬜ | Ctrl K con palabras clave | «uber» → Transporte. Solo si el uso lo pide (D28) | 🟢 |
| ⬜ | Exportar a PDF | Resumen imprimible con `window.print()` (D25) | 🟢 |

## F9 · Notificaciones (prueba de concepto)

*Opcional (D26).* Solo sigue si el primer paso funciona y las alarmas del
teléfono no alcanzan.

- [ ] Una notificación de prueba llega al teléfono con la PWA instalada.
- [ ] Recién si funciona: tabla `push_subscriptions`, la Edge Function que envía y `pg_cron` que la llama.
- [ ] Qué avisar, en una lista corta y apagable: tarea que vence hoy, toca entrenar, tope al 85 %.

## F10 · Revisión de arquitectura y buenas prácticas

- [ ] Reescribir [`ARQUITECTURA.md`](ARQUITECTURA.md) explicando **cada parte, cómo se conecta y por qué es así**: base → RLS → cliente → caché → pantallas → `core/`.
- [ ] `core/` sigue puro y con pruebas; cobertura de `core/` sobre 90 %.
- [ ] Revisar `DECISIONES.md`: si alguna quedó vieja, se marca como reemplazada, no se borra.
- [ ] Accesibilidad: contraste AA (ya viene en los tokens), foco visible, navegación con teclado en el escritorio.
- [ ] Lighthouse en el teléfono: rendimiento, PWA y accesibilidad sobre 90.

## F11 · Publicación del servicio

Antes era «Publicación forkeable»: cambió con D32. Lock In ya no se monta por
copia; hay una sola instancia y se abre a todos.
*Termina cuando una persona que no conoce el proyecto entra con Google, instala
la PWA y la usa sin preguntar nada, y el servicio cumple la ley de datos
personales.*

- [ ] **Política de privacidad y términos de uso**, en la app y enlazados en la pantalla de consentimiento de Google. Exigidos por la Ley 21.719 y por Google para publicar.
- [ ] **Rotar el secreto de Google** (el del 28-oct quedó expuesto) y **publicar la app** en Google Cloud: sale del modo Prueba y entra cualquier cuenta.
- [ ] Repetir el login con la **PWA instalada** en Android.
- [ ] `README.md` con capturas y un GIF de registrar un gasto.
- [ ] Guía corta de uso: entrar, instalar la PWA y armar el primer día.
- [ ] Revisión de secretos sobre todo el historial (`npm run check:secrets`).
- [ ] Plantillas de issue (bug, idea) y `CONTRIBUTING.md` con el flujo de [`CORRER.md`](CORRER.md).

## F12 · Prueba final y cierre

- [ ] Una semana de uso con la versión publicada; cada bug es un issue.
- [ ] Repaso de las decisiones abiertas: cada una queda tomada o explícitamente aplazada.
- [ ] Etiquetar `v1.0.0` y escribir el `CHANGELOG.md`.

---

## Ideas sin fase

Valen la pena, pero todavía no tienen lugar. Se suben a una fase cuando haga
falta.

| Idea | Por qué |
|---|---|
| **Pipeline en orden** (verificar → migrar → publicar) | Hoy Vercel, Supabase y el CI corren en paralelo al hacer push y el CI no frena nada. Que la migración y el deploy salgan de GitHub Actions solo si pasan las pruebas, más la prueba de RLS contra Supabase local. Pendiente hasta que haya usuarios (28-oct) y resolver el runner |
| **Dependabot** | Alertas y PR semanales de parches agrupados. Hoy las alertas están apagadas en GitHub |
| **Supabase local con Docker** (`supabase start`) | Que `npm run dev` no escriba en producción y probar migraciones y RLS antes del push (revisa D27) |
| **Respaldo semanal automático** con `supabase db dump` | El plan Free no deja bajar sus respaldos. Puede ir en el runner propio con una tarea programada |
| **Pruebas de punta a punta** (Playwright) del flujo de 5 segundos | Que nadie rompa la regla principal sin enterarse. Requiere instalar el navegador de pruebas |
| **Cuotas del plan Free** a la vista | 500 MB de base y 50.000 usuarios activos al mes sobran, pero conviene saber dónde mirarlo |
| **Dependabot sin `pull_request`** | Mantener las dependencias al día sin romper D15 |
| **Mensajes de error con código**, como en el diseño | Un usuario puede reportar «LI-MOV-03» y se sabe dónde buscar |

## Lo que nunca entra aquí

**Fuera de alcance** ([`PLAN.md`](PLAN.md)) no entra a esta hoja sin una
decisión explícita, y esa decisión se escribe en
[`DECISIONES.md`](DECISIONES.md). Si al mes la app no se abre a diario, el
problema no se arregla con una tarea más.
