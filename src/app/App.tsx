import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { queryClient } from '@/shared/api/queryClient'
import { useAuthStore } from '@/shared/auth'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export function App() {
  const restore = useAuthStore((s) => s.restore)
  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
