# Brief de diseño · Lock In

Documento para diseñar la interfaz completa (teléfono y escritorio) con Claude Design.
Junta lo que ya está decidido en `PLAN.md`, `MODELO_DATOS.md` y `MODELO_ECONOMICO.md`,
y deja abierto lo que todavía no se decide: la paleta y el estilo exacto.
**Este archivo es autosuficiente:** todo lo necesario para diseñar está aquí, no hacen
falta los otros documentos.

> **Qué se pide:** un mockup navegable de todas las pantallas, en teléfono y escritorio,
> con los flujos principales animados. Explorar **3 direcciones de color** sobre la misma
> estructura antes de cerrar una.

### Pantallas donde se va a usar

| Dispositivo | Pantalla física | Lienzo de diseño (px CSS) | Tasa |
|---|---|---|---|
| **Teléfono: Motorola Moto G35** (el principal) | 6,72", 1080 × 2400 | **412 × 915** (≈ 2,6x) | 120 Hz |
| **Laptop** | 1920 × 1080 | **1920 × 1080** (escala 1x) | 144 Hz |
| **Monitor externo** | 2560 × 1440 | debe escalar bien a **2560 × 1440** | 144 Hz |

- En el teléfono se usa con **Chrome en Android**, instalada como PWA (pantalla completa).
  Hay que reservar espacio para la barra de gestos de Android abajo y para la cámara
  perforada arriba.
- Las dos pantallas son de alta frecuencia (120–144 Hz): las animaciones se tienen que notar
  suaves, no entrecortadas.

---

## 1 · Qué es Lock In

Una app web instalable (PWA) que junta en un solo lugar **el horario, las tareas, el gimnasio
y la plata**. Cada una de esas cosas ya existe por separado. Lo que no existe es una sola
pantalla de inicio que responda:

> ## ¿Qué tengo que hacer hoy?

Es una herramienta personal: una persona, sus datos, sin parte social.

### Las dos reglas que mandan sobre el diseño

1. **Si registrar un gasto, una tarea o una serie toma más de 5 segundos, la app se abandona
   en dos semanas.** Nada de formularios largos, categorías obligatorias ni configuración
   previa. Lo frecuente va a un toque.
2. **Si al mes no se abre a diario, el diseño falló. Se recorta, nunca se agrega.** Ante la
   duda, una cosa menos en pantalla.

---

## 2 · Sensación buscada

| Sí | No |
|---|---|
| Moderna, minimalista **pero con detalle**: que se note que está bien hecha | Minimalismo vacío, gris sobre gris, que parezca sin terminar |
| **Oscura por defecto**, cómoda de noche | Oscura al punto de no leerse: el contraste es requisito, no opción |
| **Fluida**: cada cambio de estado se anima, nada aparece de golpe | Animaciones lentas o decorativas que hacen esperar |
| Intuitiva: se entiende sin tutorial | Íconos sin etiqueta o gestos escondidos como única forma de hacer algo |
| Densa en información donde sirve (Hoy, Plata) | Dashboard recargado de gráficos |
| Se siente app nativa en el teléfono | Página web metida en un marco |

Referencias de sensación (no copiar, tomar el tono): Linear (precisión, velocidad, oscuro bien
resuelto), Things 3 (calma, tareas sin fricción), Arc / Raycast (atajos, sensación de
herramienta), apps de finanzas tipo Copilot Money (números grandes y claros).

### Que se vea profesional, no hecha con IA

**Este es un requisito, no un detalle.** La app tiene que parecer diseñada por un equipo de
producto con criterio, no generada con IA ni armada con la plantilla de siempre. La calidad
se nota en las decisiones pequeñas, así que la consistencia y el detalle pesan más que el
efecto llamativo.

**🚫 Señales de «app hecha con IA» que hay que evitar:**

| Evitar | Por qué delata |
|---|---|
| Degradados morado-azul, texto con degradado, bordes que brillan | Es la estética por defecto de todo lo generado |
| Glassmorphism y desenfoques en todas partes | Se usa para tapar la falta de jerarquía |
| Emojis como íconos, o íconos de ✨ chispitas | Se ve improvisado |
| Todo en tarjetas iguales con la misma sombra y el mismo radio | Sin jerarquía: nada es más importante que nada |
| Filas de 3 o 4 «stat cards» simétricas con un número y un ícono | El dashboard genérico por excelencia |
| Gráficos de adorno que no responden a ninguna pregunta | Relleno |
| Textos genéricos: «¡Bienvenido de vuelta! 👋», «Desbloquea tu potencial», lorem ipsum | Suenan a plantilla y no dicen nada |
| Los componentes de shadcn/ui tal cual vienen, sin adaptar | Se reconocen al instante |
| Espaciados al ojo y alineaciones que casi calzan | Es lo primero que delata falta de oficio |
| Todo centrado, todo con el mismo peso visual | Sin ritmo ni foco |

**✅ Lo que sí transmite oficio:**
- **Un sistema de espaciado estricto** (base 4 px) y una **escala tipográfica corta**
  (4 o 5 tamaños), aplicados sin excepciones.
- **Jerarquía clara en cada pantalla:** una cosa principal, un par secundarias y el resto en
  segundo plano. Se logra con tamaño, peso y contraste, no con más cajas.
- **El acento se usa poco**, solo para la acción principal y el estado activo. Si todo tiene
  color, nada destaca.
- **Números bien tratados:** cifras tabulares, separador de miles chileno (`$12.990`),
  alineados a la derecha en las listas y con las unidades más chicas que el número.
- **Datos de ejemplo creíbles:** nombres de ramos, ejercicios y gastos reales en Chile
  («Almuerzo casino», «Bip!», «Press banca 3×8»), con montos y horarios que tengan sentido.
- **Microcopy específico y breve** en español de Chile: «Te quedan $18.400 en Vida diaria»
  es mejor que «Revisa tus finanzas».
- **Estados pensados:** vacío, cargando, error y el primer uso, diseñados con el mismo
  cuidado que la pantalla llena.
- **Detalles que nadie pide pero se notan:** alineación óptica de los íconos, focus visible
  para el teclado, bordes de 1 px con poco contraste en vez de sombras, y transiciones que
  conectan de dónde viene y a dónde va un elemento.
- **Un set de íconos coherente** (mismo trazo y tamaño), o íconos propios simples. Nunca
  mezclar sets.

**La prueba:** si una pantalla podría ser de cualquier otra app cambiándole el logo, todavía
no está lista.

---

## 3 · Plataformas y navegación

### Teléfono (lo principal)
- **Barra inferior con las 5 áreas:** Hoy · Horario · Tareas · Gimnasio · Plata. Cinco es el
  máximo que alcanza el pulgar, por eso **Ajustes no es pestaña**.
- **Cabecera:** título del área a la izquierda y **avatar** a la derecha, que lleva a Ajustes.
- **Botón global de registro rápido** (+), siempre a mano y encima de la barra. Abre una
  hoja inferior con 4 accesos: **Gasto · Tarea · Serie · Ingreso**. Es la pieza clave para
  la regla de los 5 segundos.
- Hojas inferiores (bottom sheets) para crear y editar, no pantallas nuevas.
- Respeta el notch y la barra de gestos (safe areas), porque corre instalada como PWA.
- Gestos solo como **atajo**, siempre con un botón visible que haga lo mismo: deslizar una
  tarea para completarla, deslizar entre días en Horario.

### Escritorio
- La misma lista de áreas pasa a un **menú lateral** (≈ 14 rem), con el avatar o Ajustes
  abajo.
- El contenido no se estira: columna central con ancho máximo. En **Hoy** y **Plata** se
  pueden usar 2 columnas.
- **Atajos de teclado**: `1`–`5` cambian de área, `N` abre el registro rápido y `⌘K` / `Ctrl K`
  abre una paleta de comandos ("gasto 4500 almuerzo", "tarea …").
- Hover con feedback sutil en todo lo clickeable.

### Transiciones entre áreas
- Cambio de área: fundido + desplazamiento corto (8–12 px), ~200 ms. **Nada de deslizar la
  pantalla completa.**
- El indicador de la pestaña activa **se desliza** de una pestaña a otra (forma compartida).
- Abrir una hoja: sube con resorte suave y el fondo se oscurece. Se cierra arrastrando hacia
  abajo.

---

## 4 · Pantallas

Los datos de ejemplo son inventados. Moneda de ejemplo: **CLP** (sin decimales, `$12.990`).

### 4.0 · Entrar / Crear cuenta
Correo y contraseña (sin enlace mágico, porque abriría el navegador en vez de la app
instalada). Ojo para mostrar la contraseña **dentro** del campo. Cambio entre «Entrar» y
«Crear cuenta». Errores en español y claros.
- Es la primera impresión: aquí puede lucirse la identidad (logo, un detalle animado), sin
  estorbar.

### 4.1 · Hoy (`/`) · la razón de existir
Responde «¿qué tengo que hacer hoy?» en un vistazo, sin hacer scroll en lo esencial.

| Bloque | Qué muestra |
|---|---|
| Encabezado | Fecha larga («lunes 5 de octubre») + saludo corto |
| **Tu día** | Línea de tiempo de los bloques de hoy (clases, trabajo, gimnasio), con **indicador de «ahora»** y lo que viene a continuación destacado |
| **Qué vence** | Tareas de hoy y atrasadas. Se completan con un toque desde aquí mismo |
| **Gimnasio** | Si hoy toca entrenar y qué rutina («Upper A»), racha de días. Botón «Empezar» |
| **Plata** | Sobres con su saldo y una barra de **consumo del tope** del mes. Lo que está por pasarse, resaltado |

- Escritorio: «Tu día» a la izquierda, y lo demás en columna a la derecha.
- Estado vacío honesto en cada bloque («No hay bloques para hoy»), con una acción para crear
  el primero.

### 4.2 · Horario (`/schedule`)
- **Vista día** (por defecto en el teléfono): bloques sobre una línea de horas, con color por
  materia, sala y hora. Se cambia de día deslizando o con flechas.
- **Vista semana** (por defecto en el escritorio): grilla lun–dom.
- Crear bloque: título, color, lugar y uno o más horarios (día de la semana + inicio y fin).
  Una materia puede tener varios horarios (martes **y** jueves).
- 🚫 Sin arrastrar y soltar y sin calendario mensual (decisión tomada).

### 4.3 · Tareas (`/tasks`)
- Pestañas o segmentos: **Hoy · Semana · Por categoría**.
- Crear: **escribir el título y Enter**. Fecha, categoría y prioridad son opcionales y se
  agregan con chips debajo del campo, no en un formulario.
- Completar: toque en el círculo, con animación de check satisfactoria y la tarea saliendo de
  la lista. «Deshacer» en un toast por unos segundos.
- Una tarea puede estar ligada a una materia del horario («tareas de Cálculo»).
- Categorías con color propio.

### 4.4 · Gimnasio (`/gym`)
- **Inicio:** rutina sugerida para hoy, racha y últimas sesiones.
- **Sesión activa** (la pantalla más importante del área, se usa con el teléfono en la mano y
  entre series):
  - Ejercicio actual grande. **La carga de la sesión anterior a la vista** («la vez pasada:
    3 × 8 · 60 kg»).
  - Registrar una serie = reps + peso con **steppers grandes** (± 2,5 kg, ± 1 rep) y un botón
    «Listo». Lo anterior viene precargado: en el caso normal es **un solo toque**.
  - Descanso con cuenta regresiva visible (solo visual, sin notificaciones).
  - Marcar una serie como calentamiento.
- **Rutinas:** lista y edición (ejercicios, series y reps objetivo, descanso).
- Récord personal por ejercicio, con un pequeño festejo animado cuando se supera.

### 4.5 · Plata (`/money`)
Concepto central: **el sobre es un frasco con plata**. Cada sobre tiene dos números que no hay
que confundir:
- **Saldo**: cuánto hay adentro.
- **Consumo del tope**: cuánto se gastó este mes contra su límite. Se reinicia cada mes.

| Vista | Qué tiene |
|---|---|
| **Sobres** | Tarjetas por sobre: nombre, saldo grande, barra de tope (verde → ámbar → rojo al acercarse al límite) |
| **Movimientos** | Lista por día: gastos, ingresos y transferencias entre sobres |
| **Metas** | Meta con monto objetivo, avance en % y ritmo («faltan $X, ~N meses») |

**Flujos clave:**
1. **Registrar un gasto (< 5 s):** teclado numérico grande → elegir sobre (chips con el
   último usado primero) → listo. La nota es opcional.
2. **Registrar un ingreso:** monto → la app **muestra el reparto** entre los sobres antes de
   confirmar (fijo primero, después porcentajes y al final el residual). Si el ingreso no
   alcanza, dice cuánto faltó. Animación de la plata «cayendo» en cada sobre.
3. **Barrido de fin de mes:** al abrir la app en un mes nuevo, si un sobre dejó sobrante, se
   **pregunta** «¿paso el sobrante a Ahorro?». Nunca se hace solo.

**Configurar un sobre** (las 3 perillas, en lenguaje simple):
- Cómo se llena: monto fijo · porcentaje · lo que sobre.
- Tope de gasto mensual: sí/no y monto.
- El sobrante: se queda en el sobre o pasa a otro.

**Primera vez:** elegir un preset (**Ahorro agresivo · 50/30/20 · Desde cero**) con una vista
previa de los sobres que crea.

### 4.6 · Ajustes (`/settings`, desde el avatar)
Nombre visible, moneda, zona horaria, unidad de peso (kg/lb), inicio de semana, tema
(oscuro/claro/sistema), exportar datos y cerrar sesión.

### 4.7 · Estados transversales (diseñarlos también)
- **Vacío** en cada área, con una acción para empezar.
- **Cargando**: esqueletos con shimmer suave, no spinners.
- **Sin conexión**: aviso discreto en la cabecera.
- **Error**: mensaje en español, qué pasó y qué hacer.
- **Toasts** de confirmación con «Deshacer».

---

## 5 · Dirección visual

### Color: abierto, pero oscuro primero
Todavía no hay paleta. Se piden **3 direcciones** aplicadas a la misma pantalla de **Hoy**
(teléfono y escritorio) para elegir:

| Dirección | Idea |
|---|---|
| **A · Grafito + un acento** | Fondo casi negro con un tinte frío, superficies en capas, **un solo color de acento** vivo (verde menta o lima). Sobria, tipo Linear |
| **B · Azul noche cálido** | Fondo azul muy oscuro, texto crema, acento ámbar o coral. Más cálido y menos «tech» |
| **C · Oscuro con color por área** | Base neutra y cada área con su propio color (Horario, Tareas, Gimnasio, Plata), que se usa en íconos, en el indicador de la pestaña y en Hoy para distinguir los bloques |

Reglas para cualquier dirección:
- **Contraste AA como mínimo** (4,5:1 en texto normal). Texto secundario legible, no gris
  perdido.
- Jerarquía con **capas de superficie** (fondo → tarjeta → hoja elevada), no con bordes
  marcados.
- Colores semánticos aparte del acento: éxito, alerta (tope cerca), peligro (tope pasado).
- **Modo claro también**, como alternativa en Ajustes: el sistema de tokens tiene que permitirlo.
- Los colores de materias y categorías los elige el usuario: proponer una paleta de 8–10 que se
  vea bien sobre el fondo oscuro.

### Tipografía
- Una sans moderna con **números tabulares** (los montos y los pesos se alinean). Por ejemplo,
  Inter, Geist o similar.
- Montos y números clave en tamaño grande. La plata y los kilos son protagonistas en sus áreas.

### Forma
- Esquinas redondeadas generosas pero no infladas (12–16 px en tarjetas, completas en chips).
- Íconos de trazo fino y consistentes, siempre con etiqueta en la navegación.
- Objetivos táctiles de 44 px como mínimo.

### Movimiento
Que se sienta **fluido a 120/144 Hz**: animar solo `transform` y `opacity`, con curvas de
resorte o *ease-out*, y duraciones cortas.

| Qué | Cómo |
|---|---|
| Cambio de área | Fundido + desplazamiento corto, ~200 ms |
| Indicador de pestaña | Se desliza entre pestañas |
| Hojas inferiores | Suben con resorte y se cierran arrastrando |
| Completar tarea | Check que se dibuja + la fila se colapsa |
| Números (saldos, racha) | Cuentan hasta su valor al cambiar |
| Barras de tope / metas | Se llenan al entrar en pantalla |
| Pulsar botones | Escala leve (0,97) al tocar |

- Respetar `prefers-reduced-motion`: con esa opción activada, solo fundidos.
- Nada de animaciones en bucle de adorno.

---

## 6 · Restricciones técnicas (para que el diseño sea construible)

- **Stack:** React 19 + Tailwind CSS v4 + React Router. Los colores viven como **tokens CSS en
  `oklch`** (`--color-surface`, `--color-surface-raised`, `--color-ink`, `--color-ink-muted`,
  `--color-line`, `--color-accent`, `--color-accent-ink`). Entregar la paleta elegida con esos
  nombres, ampliándolos si hace falta (semánticos, superficies extra).
- Las animaciones se tienen que poder hacer con CSS y View Transitions, o con una librería
  liviana. Nada que exija WebGL.
- Montos siempre enteros en la unidad mínima. El formato (`$12.990`) lo da la moneda del
  perfil.
- Pensado como PWA: debe verse bien en pantalla completa, sin la barra del navegador.

## 7 · Fuera de alcance (no diseñar)

Notificaciones push, conexión con el banco, calendario mensual con arrastrar y soltar,
Pomodoro o temporizadores generales, IA integrada, compartir datos con otras personas y
conversión entre monedas.

---

## 8 · Entregables

1. **3 direcciones de color** sobre la pantalla Hoy (teléfono + escritorio).
2. Con la dirección elegida: **todas las pantallas de la sección 4**, en teléfono y escritorio.
3. **Prototipo navegable** con estos flujos animados:
   - cambiar entre las 5 áreas,
   - registrar un gasto en menos de 5 segundos desde el botón +,
   - registrar un ingreso y ver el reparto,
   - crear y completar una tarea,
   - registrar una serie en una sesión de gimnasio.
4. **Tokens** (colores, tipografía, radios, sombras, duraciones y curvas) listos para pasar a
   `src/index.css`.
5. Componentes base: botón, campo, chip, tarjeta, hoja inferior, toast, barra de progreso,
   stepper, fila de lista y estado vacío.
