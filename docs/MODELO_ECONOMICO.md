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
2. Los `percent`, calculados sobre **lo que dejaron los fijos** (D20). Todos
   usan esa misma base: 60% y 15% son de la misma cifra, no se encadenan.
3. Los `residual` se reparten lo que quede, en partes iguales.

Ejemplo con un ingreso de 320.000:

| Sobre | Regla | Recibe |
|---|---|---|
| Arriendo | fijo 180.000 | 180.000 |
| Transporte | fijo 30.000 | 30.000 |
| *Base para los porcentajes* | | *110.000* |
| Vida diaria | 60% | 66.000 |
| Ocio | 15% | 16.500 |
| Ahorro | lo que sobre | 27.500 |

**Por qué no sobre el bruto:** con el bruto, un 60% de 320.000 pide 192.000
cuando solo quedan 110.000, y la app avisaría que "faltó plata" sin que falte
nada: es la regla la que pide de más. Con ingresos variables eso pasa todo el
tiempo. Sobre lo que queda, un porcentaje nunca pide plata que no existe.

**Si el ingreso no alcanza**, se sirve en orden hasta que se acaba, y la app
reporta cuánto faltó. Con D20 el faltante es siempre de un fijo ("no alcanzó
para el arriendo"), que es justo lo que vale la pena avisar. Es el "mes flaco"
resuelto sin ninguna regla especial.

Si los porcentajes suman más de 100%, el último se queda corto y el faltante
se reporta igual. La interfaz avisa al configurar los sobres, antes de que pase.

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
| **50/30/20** | Necesidades 50% · Gustos 30% · Ahorro (`residual`), que recibe el 20% restante |
| **Desde cero** | Un solo sobre `residual`; el resto lo arma cada persona |

En 50/30/20 el ahorro va como `residual` y no como `percent` 20%: así absorbe
el peso que sobra por redondeo y nunca queda plata sin sobre.

---

## Metas

**Una meta es un sobre con objetivo** (D21). No es un cuarto tipo de sobre ni
una tabla aparte: es cualquier sobre que tenga `target_minor`. Por eso se llena
con cualquiera de las tres reglas:

| Meta | Cómo se llena | Objetivo |
|---|---|---|
| Moto | fijo 40.000 cada vez que entra plata | 500.000 |
| Viaje | 10% de lo que queda | 300.000 para febrero |
| Fondo de emergencia | lo que sobre | 900.000 |

El avance es el saldo del sobre; el porcentaje, contra `target_minor`. No hay
estado duplicado: si se saca plata del sobre, la meta retrocede sola.

Para mostrar varias metas juntas bajo "Ahorro", cada sobre-meta apunta a su
grupo con `group_id`. Es solo visual: para el reparto y los saldos, cada meta
es un sobre más. Mover plata del ahorro general a una meta es una
transferencia común.

---

## El barrido nunca es automático

Cuando un sobre tiene `rollover = false` y el período cerró con sobrante, la app
**pregunta** al abrirse en el período nuevo: *"¿barro el sobrante al ahorro?"*.

Sin tareas programadas —que el plan gratuito no tiene— y, sobre todo, sin mover
plata a espaldas de nadie.
