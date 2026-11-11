import type { RouteObject } from 'react-router'
import { AdminStoresPage } from '@/admin/stores/pages/AdminStoresPage'
import { StoreRegisterPage } from '@/admin/stores/pages/StoreRegisterPage'
import { LoginPage } from '@/auth/pages/LoginPage'
import { SignupPage } from '@/auth/pages/SignupPage'
import { PasswordChangePage } from '@/auth/pages/PasswordChangePage'
import { AdminBannersPage } from '@/board/pages/AdminBannersPage'
import { AdminFaqsPage } from '@/board/pages/AdminFaqsPage'
import { AdminNoticesPage } from '@/board/pages/AdminNoticesPage'
import { FaqPage } from '@/board/pages/FaqPage'
import { NoticeDetailPage } from '@/board/pages/NoticeDetailPage'
import { NoticeListPage } from '@/board/pages/NoticeListPage'
import { MyPage } from '@/customer/my/pages/MyPage'
import { ProfileEditPage } from '@/customer/my/pages/ProfileEditPage'
import { WithdrawalPage } from '@/customer/my/pages/WithdrawalPage'
import { FirstComeQueuePage } from '@/customer/order/pages/FirstComeQueuePage'
import { OrderDetailPage } from '@/customer/order/pages/OrderDetailPage'
import { OrderHistoryPage } from '@/customer/order/pages/OrderHistoryPage'
import { PickupQrPage } from '@/customer/order/pages/PickupQrPage'
import { CategoriesPage } from '@/customer/stores/pages/CategoriesPage'
import { CustomerHomePage } from '@/customer/stores/pages/CustomerHomePage'
import { StoreDetailPage } from '@/customer/stores/pages/StoreDetailPage'
import { StoreProductDetailPage } from '@/customer/stores/pages/StoreProductDetailPage'
import { StoreProductsPage } from '@/customer/stores/pages/StoreProductsPage'
import { StoreSearchPage } from '@/customer/stores/pages/StoreSearchPage'
import { ExpiringPage } from '@/owner/inventory/pages/ExpiringPage'
import { InventoryPage } from '@/owner/inventory/pages/InventoryPage'
import { LedgerPage } from '@/owner/inventory/pages/LedgerPage'
import { LotDetailPage } from '@/owner/inventory/pages/LotDetailPage'
import { OwnerOrdersPage } from '@/owner/orders/pages/OwnerOrdersPage'
import { OwnerPickupScanPage } from '@/owner/orders/pages/OwnerPickupScanPage'
import { OwnerSalesPage } from '@/owner/sales/pages/OwnerSalesPage'
import { OwnerStorePage } from '@/owner/store/pages/OwnerStorePage'
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
      // 점주 핸드폰이 고객 픽업 QR을 찍으면 여는 화면. 점주 공통 틀 없이 핸드폰 한 화면 (추가 명세 A16)
      { path: 'pickup-scan', element: <OwnerPickupScanPage /> },
      {
        element: <OwnerLayout />,
        children: [
          { index: true, element: <RootRedirect /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'inventory/:productId', element: <LotDetailPage /> },
          { path: 'ledger', element: <LedgerPage /> },
          { path: 'expiring', element: <ExpiringPage /> },
          { path: 'orders', element: <OwnerOrdersPage /> },
          { path: 'sales', element: <OwnerSalesPage /> },
          { path: 'notices', element: <NoticeListPage basePath="/owner/notices" /> },
          { path: 'notices/:noticeId', element: <NoticeDetailPage basePath="/owner/notices" /> },
          { path: 'faq', element: <FaqPage /> },
          { path: 'store', element: <OwnerStorePage /> },
          { path: 'store/password', element: <PasswordChangePage backTo="/owner/store" /> },
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
          { path: 'stores', element: <StoreSearchPage /> },
          { path: 'stores/:storeId', element: <StoreProductsPage /> },
          { path: 'stores/:storeId/categories', element: <CategoriesPage /> },
          { path: 'stores/:storeId/info', element: <StoreDetailPage /> },
          { path: 'stores/:storeId/products/:productId', element: <StoreProductDetailPage /> },
          { path: 'stores/:storeId/products/:productId/queue', element: <FirstComeQueuePage /> },
          { path: 'orders', element: <OrderHistoryPage /> },
          { path: 'orders/pickup-qr', element: <PickupQrPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'my', element: <MyPage /> },
          { path: 'my/profile', element: <ProfileEditPage /> },
          { path: 'my/withdraw', element: <WithdrawalPage /> },
          {
            path: 'notices',
            element: (
              <NoticeListPage
                basePath="/customer/notices"
                back={{ to: '/customer/my', label: '마이페이지' }}
              />
            ),
          },
          {
            path: 'notices/:noticeId',
            element: <NoticeDetailPage basePath="/customer/notices" />,
          },
          { path: 'faq', element: <FaqPage back={{ to: '/customer/my', label: '마이페이지' }} /> },
          {
            path: 'my/password',
            element: <PasswordChangePage backTo="/customer/my" backLabel="마이페이지" />,
          },
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
          { path: 'notices', element: <AdminNoticesPage /> },
          { path: 'faqs', element: <AdminFaqsPage /> },
          { path: 'banners', element: <AdminBannersPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
]
