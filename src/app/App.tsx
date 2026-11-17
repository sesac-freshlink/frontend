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
      {/* 알림 토스트의 [보기] 버튼을 손가락으로 누르기 좋게 44px로 (sonner 기본은 24px) */}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ classNames: { actionButton: 'min-h-11! px-3! text-sm!' } }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
