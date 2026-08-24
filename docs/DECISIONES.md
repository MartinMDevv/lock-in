# Decisiones

Registro de decisiones técnicas con su motivo. Sirve para no volver a discutir
lo mismo en tres meses, y para que quien forkee entienda el porqué.

---

### D1 · El repositorio es público desde el primer commit
El proyecto sirve de portafolio y la herramienta le sirve a otros.
**Consecuencia:** el historial es permanente, así que las defensas contra
filtración existen *antes* que el código (ver D2).

### D2 · Escáner de secretos como gancho de pre-commit y como paso de CI
`scripts/check-secrets.sh` bloquea claves, tokens y datos personales.
Corre en dos lugares a propósito: el gancho local se puede saltar con
`--no-verify`, el CI no. La lista de patrones personales vive en
`.private-patterns`, que está en `.gitignore` — publicar la lista de tus datos
privados sería absurdo.

### D3 · Correo y contraseña, no enlace mágico
El enlace mágico abre en el navegador y no en la PWA instalada, dejando la
sesión en el lugar equivocado. Con sesión persistente, la contraseña se escribe
una sola vez.

### D4 · TypeScript en modo estricto
Con 14 tablas y cinco áreas, los tipos generados desde el esquema real avisan de
un campo mal escrito al momento de escribirlo. `strict` y
`noUncheckedIndexedAccess` activados: en un repo público el costo de un error
silencioso es mayor que la molestia de tipar.

### D5 · Montos enteros en unidad mínima
`0.1 + 0.2 !== 0.3`. Aplica también al peso del gimnasio (gramos) y a los
porcentajes (puntos base). Ver `docs/MODELO_DATOS.md`.

### D6 · Nada acumulado se almacena
Saldos, rachas y consumo de topes son consultas, no columnas. Un contador
guardado se desincroniza; una consulta sobre los hechos no puede mentir.

### D7 · Una sola tabla `movements` para toda la plata
Ingreso, gasto y transferencia son la misma fila con distinto `kind`. Evita
saldos duplicados y deja todo el dinero en un solo lugar auditable.

### D8 · El reparto lo dispara el ingreso, no el calendario
La app nunca adivina cuándo llega plata: la persona registra el ingreso y ahí se
reparte. El mismo código sirve para sueldo fijo mensual y para ingreso variable.
El calendario solo sirve para reiniciar el contador de los topes.

### D9 · `core/` sin React ni Supabase
Las reglas del negocio son funciones puras y probadas. La interfaz se puede
rehacer entera sin tocarlas.

### D10 · Las cinco áreas primero, la profundidad después
El valor de la app no está en ningún módulo sino en tenerlos juntos. Construir
un módulo perfecto durante tres semanas deja una app que todavía no es lo que se
prometió — y a esa altura ya se abandonó.

### D11 · Supabase en la nube, sin Docker local
Con un solo desarrollador, mantener dos entornos sincronizados cuesta más de lo
que protege. Las migraciones están versionadas en `supabase/migrations/`, así
que un fork corre `npm run db:push` y tiene el esquema completo.

### D12 · Offline solo de lectura en la v1
Ver `docs/ARQUITECTURA.md`. Se reevalúa con evidencia de uso, no por
anticipado.

### D13 · Tailwind v4 y shadcn/ui
Tailwind v4 no necesita archivo de configuración: los tokens de tema se
declaran en el CSS. shadcn/ui copia los componentes al repositorio en vez de
agregar una dependencia — accesibilidad resuelta, sin librería externa que se
pudra.

### D14 · oxlint en vez de ESLint
Viene en el andamiaje de Vite 9, es un binario en Rust y corre en milisegundos.
Una herramienta menos que configurar.
