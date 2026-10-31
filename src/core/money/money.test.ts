import { describe, expect, it } from 'vitest'
import { parseAmount, parsePercent, pressBackspace, pressDigits } from './amount'
import { balances, expenseWarning, lastExpenseEnvelope, netOf, receivedIn, spendable, spentIn } from './balance'
import type { MovementLike } from './balance'
import { buildGuide, essentialGap, exampleIncomes, GUIDE_MODELS, pickModel, setEssential, setIncome, simulateMonth } from './presets'
import type { GuideModel, GuidePlan } from './presets'

const mov = (m: Partial<MovementLike> & Pick<MovementLike, 'kind' | 'amount_minor'>): MovementLike => ({
  envelope_from: null,
  envelope_to: null,
  occurred_at: '2026-10-10T12:00:00Z',
  ...m,
})

describe('saldos', () => {
  const movimientos = [
    mov({ kind: 'income', envelope_to: 'vida', amount_minor: 100_000 }),
    mov({ kind: 'expense', envelope_from: 'vida', amount_minor: 4_500, occurred_at: '2026-10-20T15:00:00Z' }),
    mov({ kind: 'transfer', envelope_from: 'vida', envelope_to: 'ahorro', amount_minor: 10_000 }),
    mov({ kind: 'expense', envelope_from: 'vida', amount_minor: 2_000, occurred_at: '2026-09-30T23:00:00Z' }),
  ]

  it('el saldo es lo que entró menos lo que salió, transferencias incluidas', () => {
    expect(balances(movimientos)).toEqual(
      new Map([
        ['vida', 100_000 - 4_500 - 10_000 - 2_000],
        ['ahorro', 10_000],
      ]),
    )
  })

  it('el consumo del tope cuenta solo gastos dentro del período', () => {
    const inicio = new Date('2026-10-01T03:00:00Z')
    const fin = new Date('2026-11-01T03:00:00Z')
    expect(spentIn(movimientos, 'vida', inicio, fin)).toBe(4_500)
  })

  it('lo recibido del mes cuenta solo ingresos dentro del período (D33)', () => {
    const inicio = new Date('2026-10-01T03:00:00Z')
    const fin = new Date('2026-11-01T03:00:00Z')
    const conViejo = [
      ...movimientos,
      mov({ kind: 'income', envelope_to: 'vida', amount_minor: 7_000, occurred_at: '2026-09-15T12:00:00Z' }),
    ]
    // La transferencia a 'ahorro' no es plata nueva, y el ingreso de septiembre es de otro mes.
    expect(receivedIn(conViejo, inicio, fin)).toEqual(new Map([['vida', 100_000]]))
  })

  it('el último sobre usado es el del gasto más reciente', () => {
    expect(lastExpenseEnvelope(movimientos)).toBe('vida')
    expect(lastExpenseEnvelope([])).toBeNull()
  })

  it('el neto ignora las transferencias', () => {
    expect(netOf(movimientos)).toBe(100_000 - 4_500 - 2_000)
  })
})

describe('montos escritos', () => {
  it('en CLP el punto separa miles', () => {
    expect(parseAmount('12.500', 0)).toBe(12_500)
    expect(parseAmount('$ 4500', 0)).toBe(4_500)
  })

  it('con 2 decimales, la coma o el punto final son decimales', () => {
    expect(parseAmount('12,50', 2)).toBe(1_250)
    expect(parseAmount('12.5', 2)).toBe(1_250)
    expect(parseAmount('1.234,56', 2)).toBe(123_456)
    expect(parseAmount('1.234', 2)).toBe(123_400)
  })

  it('rechaza lo que no es un monto', () => {
    expect(parseAmount('', 0)).toBeNull()
    expect(parseAmount('abc', 0)).toBeNull()
    expect(parseAmount('-5', 0)).toBeNull()
    expect(parseAmount('9999999999999', 0)).toBeNull()
  })

  it('el teclado entra cifras por la derecha y ⌫ las saca', () => {
    expect(pressDigits(pressDigits(0, '4'), '5')).toBe(45)
    expect(pressDigits(45, '000')).toBe(45_000)
    expect(pressDigits(0, '0')).toBe(0)
    expect(pressBackspace(45_000)).toBe(4_500)
    expect(pressDigits(999_999_999_999, '1')).toBe(999_999_999_999)
  })

  it('los porcentajes se guardan en puntos base', () => {
    expect(parsePercent('10')).toBe(1_000)
    expect(parsePercent('12,5')).toBe(1_250)
    expect(parsePercent('101')).toBeNull()
  })
})

describe('guía de la primera vez', () => {
  const [fifty, fixedFirst, seventy] = GUIDE_MODELS as [GuideModel, GuideModel, GuideModel]
  // Montos abstractos, en una moneda sin decimales.
  const plan: GuidePlan = { model: fifty, incomeMinor: 400_000, fixedMinor: 140_000, livingMinor: 60_000 }

  it('en 50/30/20, cambiar lo esencial recalcula el ingreso que hace falta', () => {
    const p = setEssential(plan, 'fixed', 150_000, 0)
    // (150.000 + 60.000) ÷ 0,5, redondeado a $1.000.
    expect(p.incomeMinor).toBe(420_000)
  })

  it('en 50/30/20, cambiar el ingreso escala lo esencial en proporción', () => {
    const p = setIncome(plan, 500_000, 0)
    expect([p.fixedMinor, p.livingMinor]).toEqual([175_000, 75_000])
  })

  it('el redondeo va en pesos de la moneda, no en unidad mínima', () => {
    // Con 2 decimales, $1.000 son 100.000 centavos.
    const conCentavos = { ...plan, fixedMinor: 14_000_000, livingMinor: 6_000_050 }
    expect(setEssential(conCentavos, 'living', 6_000_050, 2).incomeMinor).toBe(40_000_000)
  })

  it('«Lo fijo primero» respeta el ingreso y lo fijo', () => {
    const p = pickModel(plan, fixedFirst, 0)
    expect(p.incomeMinor).toBe(400_000)
    expect(setIncome(p, 250_000, 0).fixedMinor).toBe(140_000)
    // Si el ingreso no alcanza para lo fijo, se sube hasta cubrirlo.
    expect(pickModel({ ...plan, incomeMinor: 100_000 }, fixedFirst, 0).incomeMinor).toBe(200_000)
  })

  it('pasar de un modelo de porcentaje a otro recalcula el ingreso', () => {
    expect(pickModel(plan, seventy, 0).incomeMinor).toBe(286_000) // 200.000 ÷ 0,7
  })

  it('dice cuánto falta para cubrir lo fijo', () => {
    expect(essentialGap({ ...plan, model: fixedFirst, incomeMinor: 150_000 })).toEqual({
      essentialMinor: 200_000,
      shortMinor: 50_000,
    })
  })

  it('un mes con sueldo reparte 50/30/20 sobre el ingreso', () => {
    expect(simulateMonth(plan, [400_000])).toEqual([140_000, 60_000, 120_000, 80_000])
  })

  it('un mes flojo: lo fijo se cubre igual y Gustos y Ahorro reciben menos', () => {
    expect(simulateMonth(plan, [280_000])).toEqual([140_000, 60_000, 48_000, 32_000])
  })

  it('de a poco, primero se llena lo fijo y después el resto (D33)', () => {
    const p = { ...plan, model: fixedFirst }
    expect(simulateMonth(p, [100_000, 60_000])).toEqual([140_000, 20_000, 0, 0])
    expect(simulateMonth(p, [100_000, 60_000, 90_000])).toEqual([140_000, 60_000, 10_000, 40_000])
  })

  it('crea los cuatro sobres, con tope en Vida diaria', () => {
    expect(buildGuide(plan)?.map((f) => [f.name, f.fill_rule, f.fill_value, f.cap_amount])).toEqual([
      ['Cuentas fijas', 'fixed', 140_000, null],
      ['Vida diaria', 'fixed', 60_000, 60_000],
      ['Gustos', 'percent', 6_000, null],
      ['Ahorro', 'residual', 0, null],
    ])
  })

  it('sin los montos fijos no se crea nada', () => {
    expect(buildGuide({ ...plan, livingMinor: 0 })).toBeNull()
  })

  it('el ejemplo antes del primer ingreso parte de lo que piden los fijos', () => {
    expect(exampleIncomes(201_400, 100_000, 0)).toEqual([201_000, 403_000, 604_000])
    expect(exampleIncomes(0, 100_000, 0)).toEqual([100_000, 200_000, 300_000])
  })
})

describe('lo que se puede gastar', () => {
  it('sin tope es el saldo', () => {
    expect(spendable(30_000, null, 0)).toBe(30_000)
  })

  it('con tope manda el menor: el saldo o lo que queda del tope', () => {
    expect(spendable(30_000, 20_000, 5_000)).toBe(15_000)
    expect(spendable(4_000, 20_000, 5_000)).toBe(4_000)
  })

  it('un sobre vacío no deja gastar aunque le quede tope', () => {
    expect(spendable(0, 2_000, 0)).toBe(0)
  })

  it('nunca es negativo: ni con el saldo en rojo ni pasado del tope', () => {
    expect(spendable(-1_000, null, 0)).toBe(0)
    expect(spendable(10_000, 2_000, 3_000)).toBe(0)
  })
})

describe('aviso antes de un gasto', () => {
  it('nada que avisar si alcanza y no pasa el tope', () => {
    expect(expenseWarning(5_000, 10_000, 20_000, 0)).toBeNull()
    expect(expenseWarning(5_000, 10_000, null, 0)).toBeNull()
  })

  it('si el sobre no alcanza, dice cuánto tiene y cuánto falta', () => {
    expect(expenseWarning(5_000, 2_000, null, 0)).toEqual({ kind: 'overdraw', balanceMinor: 2_000, shortMinor: 3_000 })
  })

  it('con el sobre ya en rojo, tiene $0 y falta todo lo que ya debe más el gasto', () => {
    expect(expenseWarning(1_000, -500, null, 0)).toEqual({ kind: 'overdraw', balanceMinor: 0, shortMinor: 1_500 })
  })

  it('si alcanza pero pasa el tope, dice por cuánto', () => {
    expect(expenseWarning(3_000, 10_000, 5_000, 4_000)).toEqual({ kind: 'over-cap', overMinor: 2_000 })
  })

  it('quedar en rojo se avisa antes que pasar el tope', () => {
    expect(expenseWarning(9_000, 1_000, 5_000, 4_000)?.kind).toBe('overdraw')
  })
})
