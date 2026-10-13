import { Link } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'

export function SignupPage() {
  return (
    <div className="mx-auto max-w-sm p-6">
      <Placeholder featureId="C-01" title="회원가입" owner="김경우">
        <Link to="/login" className="text-sm text-slate-500 underline">
          로그인으로
        </Link>
      </Placeholder>
    </div>
  )
}
