import { describe, expect, it } from 'vitest'
import { failedEmpty } from './query-status'

describe('failedEmpty', () => {
  it('falló sin nada guardado: se muestra el error', () => {
    expect(failedEmpty({ isError: true, data: undefined })).toBe(true)
  })

  it('falló pero hay datos guardados (F5): se muestran los datos, no el error', () => {
    expect(failedEmpty({ isError: true, data: [] })).toBe(false)
    expect(failedEmpty({ isError: true, data: [{ id: 't1' }] })).toBe(false)
  })

  it('sin error no hay nada que avisar', () => {
    expect(failedEmpty({ isError: false, data: undefined })).toBe(false)
  })
})
