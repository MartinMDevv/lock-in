import { useEffect } from 'react'

/**
 * Lo que la sesión le pide al teléfono: la pantalla encendida y el aviso
 * del descanso. Todo es «si el navegador deja»: sin soporte no pasa nada.
 */

/** Mantener la pantalla encendida mientras la sesión está abierta. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let vivo = true
    const pedir = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (vivo) lock = l
          else void l.release()
        })
        .catch(() => {
          // Batería baja o el navegador no quiso: la sesión sigue igual.
        })
    }
    pedir()
    // El navegador suelta el bloqueo al cambiar de app: se pide otra vez al volver.
    document.addEventListener('visibilitychange', pedir)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', pedir)
      void lock?.release()
    }
  }, [on])
}

let audio: AudioContext | null = null

/** Un pitido corto, sin archivos de sonido (la CSP no deja cargar de afuera). */
function beep(ms: number, freq: number) {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + ms / 1000)
  } catch {
    // Sin audio: queda la vibración, si se eligió.
  }
}

export type RestAlert = 'vibrate' | 'sound' | 'both' | 'none'

/** El aviso al terminar el descanso (largo) o 10 s antes (corto). */
export function restAlert(kind: RestAlert, early: boolean) {
  if (kind === 'none') return
  if (kind === 'vibrate' || kind === 'both') navigator.vibrate?.(early ? 80 : [200, 100, 200])
  if (kind === 'sound' || kind === 'both') {
    if (early) beep(120, 660)
    else {
      beep(180, 880)
      setTimeout(() => beep(260, 880), 260)
    }
  }
}
