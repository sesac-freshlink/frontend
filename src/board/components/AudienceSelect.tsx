import type { UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { AUDIENCE_LABEL, type Audience } from '../api'

const ALL_AUDIENCES: Audience[] = ['ALL', 'CUSTOMER', 'OWNER']

interface Props {
  id: string
  error?: string
  field: UseFormRegisterReturn
  /** 고를 수 있는 볼 사람. 없으면 모두·고객·점주 */
  options?: Audience[]
}

/** 볼 사람: 모두 / 고객 / 점주 (FAQ 는 11/14 경우 결정으로 모두 / 고객만) */
export function AudienceSelect({ id, error, field, options = ALL_AUDIENCES }: Props) {
  return (
    <FormField id={id} label="볼 사람" error={error}>
      <select id={id} aria-describedby={describedBy(id)} {...field} className={inputClass}>
        {options.map((a) => (
          <option key={a} value={a}>
            {AUDIENCE_LABEL[a]}
          </option>
        ))}
      </select>
    </FormField>
  )
}
