# Brief de diseño · Gimnasio v2

Pedido para Claude Design: **rediseñar el área Gimnasio para que sea útil en el gimnasio de
verdad**, no solo para ver las rutinas. Este brief **se suma** a `BRIEF_DISENO.md`: la dirección
visual (grafito + lima, Geist), los tokens y los componentes base **no cambian**. El aspecto
general del panel y la lista de rutinas gustan y se mantienen.

> **Qué se pide:** mockup navegable en teléfono (412 × 915, lo principal) y escritorio
> (1920 × 1080) de las pantallas y flujos de las secciones 3 y 4, con sus estados (vacío,
> cargando, sin señal, error). Lo marcado **P1** es lo primero que se implementa.

### La regla que manda aquí

Se usa **de pie, con una mano, transpirado y entre series**. Todo lo que pase durante la
sesión tiene que hacerse con el pulgar, en la mitad de abajo de la pantalla, y **anotar una
serie no puede tomar más de 5 segundos** (la regla general de Lock In).

---

## 1 · Lo que existe hoy

- **Panel** (`/gym`): sesión en curso o «Hoy toca» (rutina, hora, ejercicios con su objetivo,
  ~minutos, «Empezar sesión»); si hoy no toca, chips para entrenar igual (cada rutina +
  «Sesión libre»); racha en cuadritos; lista de rutinas; archivadas plegadas; últimas 5
  sesiones con su duración.
- **Hoja de rutina:** nombre, días y hora (quedan en el Horario), y una tarjeta por ejercicio
  con series, reps o segundos, descanso y botones ↑ ↓ ✕.
- **Sesión activa** (`/gym/session/:id`, pantalla completa): barra de progreso por ejercicio,
  un ejercicio a la vez con «La vez pasada», las series anotadas, steppers de peso y reps
  precargados con la vez pasada, «Calentamiento», «Listo · serie N», barra de descanso que
  vibra al terminar, aviso de récord y «Anterior / + Ejercicio / Siguiente».
- **Selector de ejercicios:** buscar, crear (nombre + medida: reps y peso / solo reps /
  tiempo), renombrar y archivar.

## 2 · Problemas detectados

| # | Problema | Dónde |
|---|---|---|
| 1 | Ordenar los ejercicios de una rutina es lento: solo ↑ ↓ de a un paso, y cada ejercicio es una tarjeta alta con 3 campos. Con 7 u 8 ejercicios la hoja es larguísima | Hoja de rutina |
| 2 | La sesión libre está escondida: solo aparece cuando **no** toca rutina. Si hoy toca Torso y quieres improvisar, no hay cómo | Panel |
| 3 | La sesión libre no deja nada: al terminar no se puede convertir en rutina | Sesión |
| 4 | Durante la sesión no se ve el plan completo: solo anterior/siguiente. No se puede saltar un ejercicio, cambiar el orden (máquina ocupada) ni reemplazarlo | Sesión |
| 5 | Al terminar solo sale un toast. No hay resumen, ni comparación, ni nota de cómo te sentiste | Sesión |
| 6 | «Terminar» está arriba, al lado del cronómetro, sin confirmación: es fácil cerrar la sesión sin querer | Sesión |
| 7 | Una serie mal anotada solo se puede borrar, no corregir | Sesión |
| 8 | Las sesiones pasadas no se abren: no hay forma de ver qué hiciste el martes | Panel |
| 9 | No se ve el progreso: ni gráfico por ejercicio ni resumen de la semana | Panel |
| 10 | «Hoy toca» sigue ofreciendo «Empezar sesión» aunque ya entrenaste hoy | Panel |
| 11 | El salto de peso está fijo en 2,5 kg / 5 lb, el descanso por defecto en 90 s, y no hay ajustes del área | Ajustes |

---

## 3 · Requerimientos

### P1 · Lo que lo hace usable en el gimnasio

**R1 · Ordenar la rutina arrastrando** (problema 1)
- Cada ejercicio en una fila compacta: tirador ⠿, nombre y objetivo en una línea («3 × 10 ·
  90 s»). Al tocar la fila se despliega para editar series, reps y descanso.
- Se arrastra desde el tirador (mantener presionado en el teléfono). Las flechas ↑ ↓ siguen
  existiendo para teclado y lector de pantalla, dentro de la fila desplegada.
- Diseñar: la fila en reposo, desplegada y mientras se arrastra (sombra, hueco donde cae).
- Acción extra: **Duplicar rutina** (para armar «Torso B» desde «Torso A»).

**R2 · Entrenar libre, siempre a mano** (problema 2)
- En el panel, además de «Empezar sesión», un acceso secundario y siempre visible:
  **«Entrenar libre»** (o «Otra cosa…» que abre: cada rutina + libre).
- En la sesión libre, el selector muestra primero **los ejercicios recientes** y los que
  sueles hacer juntos, para que agregar el siguiente sea un toque.

**R3 · Convertir lo que hiciste en rutina** (problema 3)
- Al terminar una sesión libre, el resumen (R5) ofrece **«Guardar como rutina»**:
  - Orden = el orden en que hiciste los ejercicios, **editable arrastrando** antes de guardar.
  - Objetivo por ejercicio = lo que hiciste (series de trabajo y reps más repetidas; o
    segundos).
  - Descanso = el que tomaste de verdad entre series (mediana, redondeada a 15 s).
  - Nombre sugerido editable y días opcionales (como en la hoja de rutina).
- Si la sesión partió de una rutina y **cambiaste algo** (agregaste, saltaste o cambiaste el
  orden), el resumen ofrece **«Actualizar Torso A»** con la lista de cambios, o dejarla igual.
- Diseñar: el resumen con la opción, la vista previa de la rutina nueva y la confirmación.

**R4 · El plan de la sesión a la vista** (problema 4)
- Tocar la barra de progreso (o deslizar hacia arriba) abre **«Plan de hoy»**: la lista de
  ejercicios con su estado (hecho / en curso / pendiente / saltado) y series hechas del total.
- Desde ahí: tocar uno para ir a él, arrastrar para cambiar el orden, **Saltar** y
  **Reemplazar** (abre el selector; queda anotado que se cambió).
- La barra de arriba mantiene su forma, pero con los saltados distinguibles.

**R5 · Terminar y resumen** (problemas 5 y 6)
- «Terminar» pasa abajo, después del último ejercicio, o pide confirmar si quedan
  pendientes («Te quedan 2 ejercicios · Terminar igual / Seguir»).
- Pantalla de **resumen**: duración, series de trabajo, volumen total, récords del día,
  comparación con la vez pasada de la misma rutina (▲ ▼ por ejercicio), y una nota opcional
  («cómo te sentiste», una línea). Abajo: R3 si corresponde, y «Listo».

### P2 · Lo que lo hace mejorar con el uso

**R6 · Corregir una serie** (problema 7): tocar una serie anotada abre sus valores en los
mismos steppers para corregirlos. Borrar sigue con su Deshacer.

**R7 · Historial de sesiones** (problema 8): las sesiones del panel se tocan y abren el
detalle (ejercicios, series, nota, duración) con «Editar» para lo que olvidaste anotar. Un
«Ver todas» lleva al historial completo agrupado por mes.

**R8 · Progreso por ejercicio** (problema 9): tocar el nombre del ejercicio (en la sesión o
en el historial) abre su ficha: gráfico de la mejor serie en el tiempo (1RM estimado para
peso, reps para corporal, segundos para tiempo), récord, y las últimas sesiones. Seguir las
reglas de `dataviz` del sistema: un solo color, sin adornos.

**R9 · La semana en el panel** (problemas 9 y 10): reemplazar los cuadritos sueltos de la
racha por **la semana L–D** con los días planificados, hechos y perdidos, más
«2 de 3 esta semana · 38 series». Si hoy ya entrenaste, «Hoy toca» pasa a estado **hecho**
(con el resumen corto) y el botón deja de ser primario.

**R10 · Sugerencia de progresión:** junto a «La vez pasada», una sugerencia sobria cuando
cumpliste el objetivo todas las series («Hiciste 3 × 10 con 40 kg → prueba 42,5»). Se acepta
con un toque (pone el peso en el stepper) o se ignora.

**R11 · Peso corporal:** anotar el peso del día (un campo, un toque) y ver su tendencia en
una línea. Entrada desde el panel de Gimnasio, abajo de la semana.

### P3 · Más adelante (diseñar solo si hay tiempo)

- **Superseries / circuitos:** agrupar 2–3 ejercicios que se alternan (necesita un cambio en
  la base).
- **Calculadora de discos:** cuánto poner por lado según el peso de la barra.
- **Grupo muscular** al crear un ejercicio y filtro por grupo en el selector; series por
  grupo en el resumen de la semana.
- **RPE** opcional por serie (esfuerzo 1–10), oculto por defecto.

---

## 4 · Ajustes › Gimnasio (sección nueva)

Va en la lista de Ajustes, con el mismo formato de las demás secciones (se guarda al tocar).

| Ajuste | Opciones | Por defecto |
|---|---|---|
| Descanso por defecto | 30 s … 5 min | 90 s |
| Empezar el descanso solo al anotar | sí / no | sí |
| Aviso al terminar el descanso | vibrar / sonido / ambos / nada | vibrar |
| Avisar 10 s antes | sí / no | no |
| Mantener la pantalla encendida en la sesión | sí / no | sí |
| Salto del peso | 1 · 1,25 · 2,5 · 5 kg (o 2,5 · 5 lb) | 2,5 kg |
| Precargar con | la vez pasada / el objetivo de la rutina | la vez pasada |
| Mostrar calentamiento | sí / no | sí |
| Mostrar RPE | sí / no | no |
| Peso de la barra (calculadora) | 20 kg / 15 kg / otro | 20 kg |
| Al terminar una sesión libre | ofrecer guardarla como rutina / no preguntar | ofrecer |

La unidad de peso (kg / lb) ya está en Ajustes generales y no se mueve.

---

## 5 · Fuera de alcance (no diseñar)

- Parte social, compartir entrenamientos, rankings.
- Biblioteca de ejercicios con videos o animaciones.
- Planes automáticos o generados por IA.
- Relojes y sensores (pulso, calorías).

## 6 · Entregables

1. Panel de Gimnasio v2 (con la semana, «Hoy toca» hecho y «Entrenar libre»).
2. Hoja de rutina con filas compactas y arrastre (reposo, desplegada, arrastrando).
3. Sesión activa: plan de hoy, saltar/reemplazar, corregir serie, terminar con confirmación.
4. Resumen al terminar, con «Guardar como rutina» y «Actualizar rutina».
5. Historial de sesiones y detalle de una sesión.
6. Ficha de progreso de un ejercicio.
7. Peso corporal.
8. Ajustes › Gimnasio.

---

## Anexo · Qué pide cada cosa en la base (para implementar, no para diseñar)

- **Sin migración:** R1, R2, R4 (el orden de la sesión sale de `created_at` de las series; lo
  saltado y reemplazado vive en la pantalla), R5 (`workouts.notes` ya existe), R6, R7, R8,
  R9, R10, R11 (`body_measurements` ya existe). R3 usa las mismas mutaciones de rutina; el
  descanso real sale de la diferencia entre `created_at` de series seguidas.
- **RPE:** la columna `workout_sets.rpe` ya existe, solo falta la interfaz.
- **Con migración:** los ajustes de la sección 4 (columnas en `profiles` o una tabla
  `gym_settings`, a decidir) y las superseries (`routine_exercises.group_id`).
- **Lógica nueva en `src/core/gym/`** (pura, con pruebas): rutina a partir de una sesión,
  descanso real, sugerencia de progresión, 1RM estimado, resumen de la semana.
