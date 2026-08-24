# Modelo económico

Cómo funciona el área de Plata. El diseño no asume ninguna situación personal:
todo sale de tres conceptos.

---

## El sobre es un frasco

Cada sobre responde dos preguntas **distintas**, y confundirlas es el error
habitual de las apps de presupuesto:

- **Saldo** — cuánta plata hay adentro. Acumulativo. Solo cambia si entra o sale
  plata.
- **Consumo del tope** — cuánto se lleva gastado en el período actual. Se
  reinicia solo.

Ejemplo, con un sobre de tope mensual 500:

| Momento | Saldo | Consumo del tope |
|---|---|---|
| Entra el ingreso y se reparte | 500 | 0 / 500 |
| Un gasto de 30 | 470 | 30 / 500 |
| Cierre de mes, se gastaron 420 | 80 | 420 / 500 |
| Día 1 del mes siguiente | **80** (la plata no desaparece) | **0 / 500** (la vara se reinicia) |

---

## El reparto lo dispara el ingreso, no el calendario

> La app nunca adivina cuándo llega la plata. La persona registra el ingreso y
> la app lo reparte en ese momento.

Esto hace que el mismo código sirva para dos mundos que normalmente necesitan
apps distintas:

| Situación | Cómo se usa |
|---|---|
| Sueldo fijo mensual | Se registra un ingreso al mes y se reparte |
| Ingreso variable, freelance, propinas | Se registra cada entrada cuando ocurre |

El calendario cumple una sola función: **reiniciar el contador de los topes.**

---

## Las tres perillas de un sobre

| Perilla | Valores | Qué decide |
|---|---|---|
| `fill_rule` + `fill_value` | `fixed` · `percent` · `residual` | Cómo se llena cuando entra plata |
| `cap_amount` + `cap_period` | monto + `month` \| `none` | Tope de gasto y cada cuánto se reinicia |
| `rollover` | `true` \| `false` | Si el sobrante del período queda o se barre a otro sobre |

### Orden de servicio ante un ingreso

1. Los sobres `fixed`, por orden. Cobran primero porque son intocables.
2. Los `percent`, calculados sobre el **ingreso bruto** — así "10% de gustos"
   significa lo mismo mes a mes.
3. Los `residual` se reparten lo que quede, en partes iguales.

**Si el ingreso no alcanza**, se sirve en orden hasta que se acaba, y la app
reporta cuánto faltó. Es el "mes flaco" resuelto sin ninguna regla especial.

**Si sobra y no hay sobre residual**, la app avisa en vez de perder la plata en
silencio.

Implementación y pruebas: `src/core/money/allocate.ts`.

---

## El cambio que hace la diferencia

En el reparto clásico el ahorro es el residual: se ahorra "lo que sobre", y no
sobra nunca.

Al poner **tope al gasto** y dejar el **ahorro como residual**, la relación se
invierte: el gasto tiene techo y lo que sobra se ahorra por diseño. La app no
obliga a usarlo así —es solo una combinación de las tres perillas— pero es la
que viene en el preset recomendado.

---

## Presets

Un preset es un botón que inserta sobres ya configurados. Son **filas, no
código**: quien los usa los edita o los borra.

| Preset | Composición |
|---|---|
| **Ahorro agresivo** | Cuentas fijas (`fixed`) · Vida diaria (`fixed` + tope) · Gustos (`percent`) · Ahorro (`residual`) |
| **50/30/20** | Necesidades 50% · Gustos 30% · Ahorro 20%, todo `percent` |
| **Personalizado** | Se parte de cero |

---

## Metas

Una meta apunta a un sobre. El avance es el saldo de ese sobre; el porcentaje,
contra `target_minor`. No hay estado duplicado: si se saca plata del sobre, la
meta retrocede sola.

---

## El barrido nunca es automático

Cuando un sobre tiene `rollover = false` y el período cerró con sobrante, la app
**pregunta** al abrirse en el período nuevo: *"¿barro el sobrante al ahorro?"*.

Sin tareas programadas —que el plan gratuito no tiene— y, sobre todo, sin mover
plata a espaldas de nadie.
