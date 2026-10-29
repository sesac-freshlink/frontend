import type { RouteObject } from 'react-router'
import { AdminStoresPage } from '@/admin/stores/pages/AdminStoresPage'
import { StoreRegisterPage } from '@/admin/stores/pages/StoreRegisterPage'
import { LoginPage } from '@/auth/pages/LoginPage'
import { SignupPage } from '@/auth/pages/SignupPage'
import { OrderDetailPage } from '@/customer/order/pages/OrderDetailPage'
import { CustomerHomePage } from '@/customer/stores/pages/CustomerHomePage'
import { StoreProductDetailPage } from '@/customer/stores/pages/StoreProductDetailPage'
import { StoreProductsPage } from '@/customer/stores/pages/StoreProductsPage'
import { ExpiringPage } from '@/owner/inventory/pages/ExpiringPage'
import { InventoryPage } from '@/owner/inventory/pages/InventoryPage'
import { LedgerPage } from '@/owner/inventory/pages/LedgerPage'
import { LotDetailPage } from '@/owner/inventory/pages/LotDetailPage'
import { OwnerOrdersPage } from '@/owner/orders/pages/OwnerOrdersPage'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { OwnerLayout } from './layouts/OwnerLayout'
import { RequireRole, RootRedirect } from './RequireRole'

/** 화면 목록은 README 3장과 같다. 화면을 추가하면 두 곳을 함께 고친다 */
export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/owner',
    element: <RequireRole role="OWNER" />,
    children: [
      {
        element: <OwnerLayout />,
        children: [
          { index: true, element: <RootRedirect /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'inventory/:productId', element: <LotDetailPage /> },
          { path: 'ledger', element: <LedgerPage /> },
          { path: 'expiring', element: <ExpiringPage /> },
          { path: 'orders', element: <OwnerOrdersPage /> },
        ],
      },
    ],
  },
  {
    path: '/customer',
    element: <RequireRole role="CUSTOMER" />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          { index: true, element: <CustomerHomePage /> },
          { path: 'stores/:storeId', element: <StoreProductsPage /> },
          { path: 'stores/:storeId/products/:productId', element: <StoreProductDetailPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <RequireRole role="ADMIN" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <RootRedirect /> },
          { path: 'stores', element: <AdminStoresPage /> },
          { path: 'stores/new', element: <StoreRegisterPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
]
