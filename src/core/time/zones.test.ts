import { describe, expect, it } from 'vitest'
import { groupZones, regionOf, utcOffset, zoneLabel } from './zones'

describe('zonas horarias en dos pasos', () => {
  const zonas = ['Europe/Madrid', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Lima', 'UTC']

  it('agrupa por región, con América primero y las ciudades en orden', () => {
    const grupos = groupZones(zonas)
    expect(grupos.map((g) => g.label)).toEqual(['América', 'Europa', 'Otras'])
    expect(grupos[0]?.zones.map((z) => z.city)).toEqual(['Buenos Aires, Argentina', 'Lima', 'Santiago'])
  })

  it('el nombre legible pone la ciudad antes que la región', () => {
    expect(zoneLabel('America/Santiago')).toBe('Santiago · América')
    expect(zoneLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires, Argentina · América')
    expect(zoneLabel('UTC')).toBe('UTC')
    expect(regionOf('Etc/GMT+3')).toBe('other')
  })

  it('el desfase con UTC depende de la fecha (horario de verano)', () => {
    expect(utcOffset('America/Santiago', new Date('2026-10-29T12:00:00Z'))).toBe('UTC−3')
    expect(utcOffset('America/Santiago', new Date('2026-07-01T12:00:00Z'))).toBe('UTC−4')
    expect(utcOffset('Asia/Kolkata', new Date('2026-10-29T12:00:00Z'))).toBe('UTC+5:30')
  })
})
