import { Link } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'

export function CustomerHomePage() {
  return (
    <Placeholder featureId="U-01" title="점포 검색" owner="김경우">
      <Link to="/customer/stores/1" className="text-sm text-emerald-600 underline">
        예시 점포 1로 가기
      </Link>
    </Placeholder>
  )
}
