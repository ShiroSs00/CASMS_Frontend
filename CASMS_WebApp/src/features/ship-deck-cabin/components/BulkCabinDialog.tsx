import { useMemo, useState } from 'react'
import { Button, Modal, Notice } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { cabinTypes } from '../model/types'
import type { Cabin, CabinType, Deck, Ship } from '../model/types'
import { InputField, SelectField } from './Common'
import styles from './Management.module.css'

type DistributionPreset =
  | 'EVEN_OCEAN_ODD_BALCONY'
  | 'EVEN_OCEAN_ODD_INTERIOR'
  | 'OCEAN_VIEW'
  | 'BALCONY'
  | 'INTERIOR'
  | 'SUITE_BALCONY_OCEAN'

type CabinItemDraft = {
  number: string
  type: CabinType
  capacity: number
  accessible: boolean
  selected: boolean
  exists: boolean
}

const presets: Record<DistributionPreset, string> = {
  EVEN_OCEAN_ODD_BALCONY: 'Thực tế: Chẵn Ocean View / Lẻ Balcony',
  EVEN_OCEAN_ODD_INTERIOR: 'Tầng thấp: Chẵn Ocean View / Lẻ Interior',
  OCEAN_VIEW: 'Tất cả là Ocean View',
  BALCONY: 'Tất cả là Balcony',
  INTERIOR: 'Tất cả là Interior',
  SUITE_BALCONY_OCEAN: 'Phân tầng: Đầu dãy Suite, Giữa Balcony, Đuôi Ocean View',
}

function resolveCabinType(index: number, total: number, preset: DistributionPreset): CabinType {
  switch (preset) {
    case 'OCEAN_VIEW':
      return 'OCEAN_VIEW'
    case 'BALCONY':
      return 'BALCONY'
    case 'INTERIOR':
      return 'INTERIOR'
    case 'EVEN_OCEAN_ODD_INTERIOR':
      return index % 2 === 0 ? 'OCEAN_VIEW' : 'INTERIOR'
    case 'EVEN_OCEAN_ODD_BALCONY':
      return index % 2 === 0 ? 'OCEAN_VIEW' : 'BALCONY'
    case 'SUITE_BALCONY_OCEAN': {
      if (index === 0 || index === 1) return 'SUITE'
      if (index < Math.floor(total * 0.6)) return 'BALCONY'
      return 'OCEAN_VIEW'
    }
    default:
      return 'OCEAN_VIEW'
  }
}

export function BulkCabinDialog({
  ship,
  deck,
  existingCabins,
  onClose,
  onSuccess,
}: {
  ship: Ship
  deck: Deck
  existingCabins: Cabin[]
  onClose: () => void
  onSuccess: (count: number) => void
}) {
  const [prefix, setPrefix] = useState(String(deck.number))
  const [startNum, setStartNum] = useState(0)
  const [endNum, setEndNum] = useState(20)
  const [preset, setPreset] = useState<DistributionPreset>('EVEN_OCEAN_ODD_BALCONY')
  const [defaultCapacity, setDefaultCapacity] = useState(2)
  const [autoAccessible, setAutoAccessible] = useState(true)
  const [overrides, setOverrides] = useState<Record<string, Partial<CabinItemDraft>>>({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; currentNum: string } | null>(null)
  const [error, setError] = useState('')

  // Compute preview items declaratively
  const items = useMemo(() => {
    const list: CabinItemDraft[] = []
    const start = Math.min(startNum, endNum)
    const end = Math.max(startNum, endNum)
    const total = end - start + 1
    const padLen = end >= 100 ? 3 : 2

    const existingSet = new Set(
      existingCabins.filter((c) => c.shipId === ship.id).map((c) => c.number.trim().toUpperCase())
    )

    for (let i = start; i <= end; i += 1) {
      const numStr = String(i).padStart(padLen, '0')
      const cabinNum = `${prefix.trim()}${numStr}`
      const isExisting = existingSet.has(cabinNum.toUpperCase())
      const isFirst = i === start

      const base: CabinItemDraft = {
        number: cabinNum,
        type: resolveCabinType(i - start, total, preset),
        capacity: defaultCapacity,
        accessible: autoAccessible && isFirst,
        selected: !isExisting,
        exists: isExisting,
      }

      const override = overrides[cabinNum]
      if (override) {
        list.push({ ...base, ...override, exists: isExisting, selected: isExisting ? false : (override.selected ?? base.selected) })
      } else {
        list.push(base)
      }
    }

    return list
  }, [prefix, startNum, endNum, preset, defaultCapacity, autoAccessible, existingCabins, ship.id, overrides])

  const selectedCount = items.filter((item) => item.selected && !item.exists).length

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, Partial<CabinItemDraft>> = { ...overrides }
    items.forEach((it) => {
      if (!it.exists) {
        next[it.number] = { ...next[it.number], selected: checked }
      }
    })
    setOverrides(next)
  }

  const updateItem = (number: string, field: keyof CabinItemDraft, val: unknown) => {
    setOverrides((curr) => ({
      ...curr,
      [number]: { ...curr[number], [field]: val },
    }))
  }

  const handleSave = async () => {
    const toCreate = items.filter((it) => it.selected && !it.exists)
    if (toCreate.length === 0) return

    setSaving(true)
    setError('')
    setProgress({ current: 0, total: toCreate.length, currentNum: toCreate[0].number })

    try {
      for (let i = 0; i < toCreate.length; i += 1) {
        const item = toCreate[i]
        setProgress({ current: i + 1, total: toCreate.length, currentNum: item.number })

        await shipDeckCabinApi.saveCabin({
          shipId: ship.id,
          deckId: deck.id,
          number: item.number,
          type: item.type,
          capacity: item.capacity,
          accessible: item.accessible,
          status: 'AVAILABLE',
        })
      }

      onSuccess(toCreate.length)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo danh sách cabin.')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <Modal
      title={`Tự động khởi tạo cabin · Boong ${deck.number} (${deck.name || 'Chưa đặt tên'})`}
      wide
      busy={saving}
      onClose={onClose}
    >
      <div className={styles.stack}>
        <Notice title={`Tàu: ${ship.code} · ${ship.name}`}>
          Tự động sinh dải số phòng theo số boong (ví dụ: Boong {deck.number} &rarr; phòng {prefix}00 đến {prefix}20) và tự động thiết lập phân loại Ocean View, Balcony, Interior.
        </Notice>

        {error && <Notice title="Không thể tạo cabin" tone="error">{error}</Notice>}

        {saving && progress && (
          <Notice title="Đang tạo cabin..." tone="info">
            Đang lưu cabin <strong>{progress.currentNum}</strong> ({progress.current}/{progress.total})...
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          </Notice>
        )}

        <div className={styles.grid}>
          <InputField
            label="Tiền tố số phòng *"
            value={prefix}
            disabled={saving}
            onChange={(e) => setPrefix(e.target.value)}
            hint={`Mặc định số boong: ${deck.number}`}
          />
          <InputField
            label="Phòng bắt đầu *"
            type="number"
            min={0}
            max={999}
            value={startNum}
            disabled={saving}
            onChange={(e) => setStartNum(Number(e.target.value))}
            hint={`Tạo từ: ${prefix}${String(startNum).padStart(2, '0')}`}
          />
          <InputField
            label="Phòng kết thúc *"
            type="number"
            min={startNum}
            max={999}
            value={endNum}
            disabled={saving}
            onChange={(e) => setEndNum(Number(e.target.value))}
            hint={`Đến: ${prefix}${String(endNum).padStart(2, '0')}`}
          />
        </div>

        <div className={styles.grid}>
          <SelectField
            label="Quy tắc phân loại phòng tự động"
            value={preset}
            disabled={saving}
            onChange={(val) => setPreset(val as DistributionPreset)}
          >
            {Object.entries(presets).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </SelectField>

          <InputField
            label="Sức chứa mỗi phòng"
            type="number"
            min={1}
            max={10}
            value={defaultCapacity}
            disabled={saving}
            onChange={(e) => setDefaultCapacity(Number(e.target.value))}
            hint="Mặc định: 2 khách / phòng"
          />

          <label className={`${styles.check} ${styles.full}`} style={{ marginTop: '24px' }}>
            <input
              type="checkbox"
              checked={autoAccessible}
              disabled={saving}
              onChange={(e) => setAutoAccessible(e.target.checked)}
            />
            Đánh dấu phòng đầu tiên hỗ trợ người khuyết tật
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '14px' }}>
              Xem trước &amp; Tùy chỉnh danh sách ({items.length} phòng &bull; Đã chọn {selectedCount} phòng)
            </strong>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={styles.link}
                disabled={saving}
                onClick={() => toggleSelectAll(true)}
              >
                Chọn tất cả
              </button>
              <span>|</span>
              <button
                type="button"
                className={styles.link}
                disabled={saving}
                onClick={() => toggleSelectAll(false)}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          <div className={styles.previewBox}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Chọn</th>
                  <th style={{ width: '100px' }}>Số cabin</th>
                  <th style={{ width: '160px' }}>Loại cabin</th>
                  <th style={{ width: '100px' }}>Sức chứa</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Tiếp cận</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.number} style={{ opacity: item.exists ? 0.6 : 1 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={saving || item.exists}
                        onChange={(e) => updateItem(item.number, 'selected', e.target.checked)}
                      />
                    </td>
                    <td>
                      <strong>{item.number}</strong>
                    </td>
                    <td>
                      <select
                        value={item.type}
                        disabled={saving || item.exists || !item.selected}
                        onChange={(e) => updateItem(item.number, 'type', e.target.value as CabinType)}
                      >
                        {Object.entries(cabinTypes).map(([code, name]) => (
                          <option key={code} value={code}>{name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        style={{ width: '60px' }}
                        value={item.capacity}
                        disabled={saving || item.exists || !item.selected}
                        onChange={(e) => updateItem(item.number, 'capacity', Number(e.target.value))}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.accessible}
                        disabled={saving || item.exists || !item.selected}
                        onChange={(e) => updateItem(item.number, 'accessible', e.target.checked)}
                      />
                    </td>
                    <td>
                      {item.exists ? (
                        <span className={styles.existingTag}>Đã tồn tại (Bỏ qua)</span>
                      ) : (
                        <span className={styles.validTag}>Sẵn sàng tạo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            disabled={saving || selectedCount === 0}
            onClick={() => void handleSave()}
          >
            {saving ? 'Đang tạo cabin…' : `Xác nhận tạo ${selectedCount} cabin`}
          </Button>
          <Button tone="secondary" disabled={saving} onClick={onClose}>
            Hủy
          </Button>
        </div>
      </div>
    </Modal>
  )
}
