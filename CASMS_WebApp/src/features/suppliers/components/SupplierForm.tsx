import { useState, type FormEvent } from 'react'
import { Button, Field } from '@/shared/ui'
import {
  supplierFormFieldOrder,
  supplierFormFields,
  validateSupplierForm,
  type SupplierFormField,
  type SupplierFormMode,
  type SupplierFormValues,
} from '../model/supplier-form'
import styles from './SupplierForm.module.css'

export type SupplierFormProps = {
  mode: SupplierFormMode
  initialValues: SupplierFormValues
  isSubmitting?: boolean
  apiError?: string | null
  onSubmitValues?: (values: SupplierFormValues) => void
  onCancel: () => void
}

export function SupplierForm({
  mode,
  initialValues,
  isSubmitting = false,
  apiError = null,
  onSubmitValues,
  onCancel,
}: SupplierFormProps) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<SupplierFormField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const errors = validateSupplierForm(values)
  const errorFor = (field: SupplierFormField) =>
    submitted || touched[field] ? errors[field] : undefined
  const change = (field: SupplierFormField, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }))
  const blur = (field: SupplierFormField) =>
    setTouched((previous) => ({ ...previous, [field]: true }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const firstInvalid = supplierFormFieldOrder.find((field) => errors[field])
    if (firstInvalid) {
      const control = event.currentTarget.elements.namedItem(firstInvalid)
      if (control instanceof HTMLElement) control.focus()
      return
    }
    if (onSubmitValues && !isSubmitting) {
      onSubmitValues(values)
    }
  }

  const input = (field: Exclude<SupplierFormField, 'notes'>) => {
    const definition = supplierFormFields[field]
    const id = `supplier-form-${field}`
    const error = errorFor(field)
    return (
      <Field
        htmlFor={id}
        label={`${definition.label}${definition.required ? ' *' : ''}`}
        error={error}
      >
        <input
          id={id}
          name={field}
          type={definition.type}
          required={definition.required}
          placeholder={definition.placeholder}
          value={values[field]}
          disabled={isSubmitting}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-hint` : undefined}
          onChange={(event) => change(field, event.target.value)}
          onBlur={() => blur(field)}
        />
      </Field>
    )
  }

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      noValidate
      aria-label={mode === 'create' ? 'Thêm nhà cung cấp' : 'Chỉnh sửa nhà cung cấp'}
    >
      <h2>Nhà cung cấp</h2>
      <div className={styles.fieldRow}>
        {input('supplierName')}
        {input('supplierType')}
      </div>
      <h2>Liên hệ chính</h2>
      <div className={styles.fieldRow}>
        {input('contactName')}
        {input('contactPhone')}
      </div>
      <div className={styles.fieldRow}>
        {input('contactEmail')}
        <div className={styles.context}>
          <p>Trạng thái &amp; xác minh</p>
          <p>Được quản lý ngoài biểu mẫu này.</p>
        </div>
      </div>
      <div className={styles.notes}>
        <Field htmlFor="supplier-form-notes" label="Ghi chú" error={errorFor('notes')}>
          <textarea
            id="supplier-form-notes"
            name="notes"
            placeholder={supplierFormFields.notes.placeholder}
            value={values.notes}
            disabled={isSubmitting}
            aria-invalid={Boolean(errorFor('notes'))}
            aria-describedby={errorFor('notes') ? 'supplier-form-notes-hint' : undefined}
            onChange={(event) => change('notes', event.target.value)}
            onBlur={() => blur('notes')}
          />
        </Field>
      </div>

      {apiError && (
        <div className={styles.apiErrorBanner} role="alert">
          {apiError}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          tone="secondary"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Hủy
        </Button>
        <Button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Đang tạo...'
              : 'Đang lưu...'
            : mode === 'create'
              ? 'Tạo nhà cung cấp'
              : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  )
}
