import type { UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { AUDIENCE_LABEL, type Audience } from '../api'

const AUDIENCES: Audience[] = ['ALL', 'CUSTOMER', 'OWNER']

interface Props {
  id: string
  error?: string
  field: UseFormRegisterReturn
}

/** 볼 사람: 모두 / 고객 / 점주 */
export function AudienceSelect({ id, error, field }: Props) {
  return (
    <FormField id={id} label="볼 사람" error={error}>
      <select id={id} aria-describedby={describedBy(id)} {...field} className={inputClass}>
        {AUDIENCES.map((a) => (
          <option key={a} value={a}>
            {AUDIENCE_LABEL[a]}
          </option>
        ))}
      </select>
    </FormField>
  )
}
