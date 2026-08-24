# Instrucciones del repositorio

Contexto para asistentes de código que trabajen en este proyecto.

## Antes que nada

**Este repositorio es PÚBLICO.** Lo que entra al historial de git no se borra.
Jamás escribir en el código, en las pruebas, en la semilla ni en la
documentación: montos reales, nombres de personas, correos, rutas del sistema
del autor, ramos, metas ni claves.

`scripts/check-secrets.sh` corre como gancho de pre-commit y como paso de CI.
Si bloquea algo, la respuesta es sacar el dato — nunca `--no-verify`.

## Idioma

- Identificadores, archivos y carpetas: **inglés**
- Comentarios y textos de interfaz: **español**

## Reglas que no se negocian

1. **`src/core/` es puro.** Si una función necesita `import React` o
   `import supabase`, no pertenece ahí. Toda regla de negocio vive en `core/`
   y tiene pruebas.
2. **RLS se activa en la misma migración que crea la tabla**, con las cuatro
   políticas (`select`, `insert`, `update`, `delete`) sobre `auth.uid() = user_id`.
3. **Los montos son enteros en unidad mínima.** Nunca `float`. Aplica al peso
   del gimnasio (gramos) y a los porcentajes (puntos base).
4. **Nada acumulado se guarda en columnas.** Saldos, rachas y consumo de topes
   se calculan. Ver `docs/DECISIONES.md` D6.
5. **`src/types/database.ts` no se edita a mano.** Se regenera con
   `npm run db:types`.
6. **Un push a `main` aplica migraciones a la base de producción.** El proyecto
   de Supabase está conectado al repositorio: lo que entre a
   `supabase/migrations/` se ejecuta solo contra la base real. Se prueba en
   rama antes de mergear y una migración aplicada no se edita — se corrige con
   otra. Ver `docs/DECISIONES.md` D16.
7. **El CI corre en un runner propio y solo con `push`.** Nunca agregar el
   disparador `pull_request` al flujo: el repo es público y ejecutaría código
   de forks ajenos en la máquina del autor. Ver `docs/DECISIONES.md` D15.

## Antes de proponer un commit

```bash
npm run check    # secretos + lint + tipos + pruebas
```

## Commits

- Conventional Commits, descripción en español.
- **Sin firma ni `Co-Authored-By` de asistentes.**
- **Ningún commit ni push sin aprobación explícita del autor.**
- **Se commitea directo a `main`, sin ramas** (ver `docs/DECISIONES.md` D17).
  Como cada push a `main` aplica migraciones a producción, una migración va
  sola en su commit, nunca mezclada con código.

## Alcance

`docs/PLAN.md` tiene una sección "Fuera de alcance" que es una decisión tomada,
no una lista de pendientes. No proponer nada de ahí sin que lo pidan.

Cuando el uso real y el plan se contradigan, gana el uso real:
**se recorta, nunca se agrega.**
