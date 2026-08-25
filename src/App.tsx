import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { useAuth } from '@/features/auth/auth-context'
import { LoginPage } from '@/features/auth/LoginPage'
import { TodayPage } from '@/features/today/TodayPage'
import { SchedulePage } from '@/features/schedule/SchedulePage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { GymPage } from '@/features/gym/GymPage'
import { MoneyPage } from '@/features/money/MoneyPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un minuto sin volver a pedir lo mismo: son datos de una sola persona
      // y cambian cuando ella los cambia, no solos.
      staleTime: 60_000,
      // La app corre en el teléfono, con conexión intermitente: reintentar
      // una vez evita el error por un túnel, sin quedarse pegado si no hay red.
      retry: 1,
    },
  },
})

/**
 * Decide entre login y app.
 *
 * Va acá y no en cada ruta a propósito: la sesión se pregunta una sola vez y
 * ninguna pantalla de adentro tiene que acordarse de comprobarla. Lo que de
 * verdad protege los datos igual no es esto, es RLS en la base.
 */
function Rutas() {
  const { session, loading } = useAuth()

  // Mientras se restaura la sesión guardada no se muestra ninguna de las dos:
  // enseñar el login medio segundo y cambiarlo se ve como un error.
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-ink-muted">Cargando…</p>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="gym" element={<GymPage />} />
        <Route path="money" element={<MoneyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Cualquier otra cosa vuelve a Hoy: con seis rutas fijas, una
            pantalla de "no encontrado" sería más ruido que ayuda. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Rutas />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
