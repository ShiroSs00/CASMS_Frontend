import { Suspense, useCallback, useContext } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Loading, Notice } from '@/shared/ui'
import { shipTypesApi, storedAssetPath, shipError, type DesignManifest, type StoredDesign } from './api'
import { metadataIssues } from './design-metadata'
import styles from './ShipWork.module.css'

import { ShipViewerContext } from './viewer-context'

export function DesignPreviewContent({ design, manifest }: { design: StoredDesign; manifest: DesignManifest }) {
  const Canvas = useContext(ShipViewerContext)?.PreviewCanvas
  const file = manifest.assets.full ?? ''
  const missing = metadataIssues(manifest)
  return <div className={styles.stack}>
    <dl className={styles.facts}>
      <div><dt>Tên loại từ manifest</dt><dd>{manifest.name || 'Chưa có'}</dd></div>
      <div><dt>Nhà sản xuất</dt><dd>{manifest.shipManufacturerName || 'Chưa có'}</dd></div>
      <div><dt>Loại động cơ</dt><dd>{manifest.engineType || 'Chưa có'}</dd></div>
      <div><dt>Sức chứa thiết kế</dt><dd>{manifest.passengerCapacity ?? 'Chưa có'}</dd></div>
      <div><dt>Boong hành khách</dt><dd>{manifest.deckCount ?? 'Chưa có'}</dd></div>
      <div><dt>Số cabin trong mô hình</dt><dd>{manifest.cabins.length}</dd></div>
      <div><dt>Chiều dài</dt><dd>{manifest.length ? manifest.length + ' m' : 'Chưa có'}</dd></div>
      <div><dt>Chiều rộng</dt><dd>{manifest.beam ? manifest.beam + ' m' : 'Chưa có'}</dd></div>
    </dl>
    {missing.length > 0 && <Notice title="Metadata cần sửa trong ZIP" tone="warning">
      <ul>{missing.map(label => <li key={label}>{label}</li>)}</ul>
    </Notice>}
    <Suspense fallback={<Loading label="Đang mở khung xem 3D…" />}>
      {Canvas && <Canvas key={design.assetVersion} file={file} sourcePath={storedAssetPath(design, file)} />}
    </Suspense>
  </div>
}

export function DesignPreview({ design }: { design: StoredDesign }) {
  const { modelKey, assetVersion } = design
  const load = useCallback((signal: AbortSignal) => shipTypesApi.preview({ modelKey, assetVersion }, signal), [modelKey, assetVersion])
  const result = useReadQuery('stored-preview:' + modelKey + ':' + assetVersion, load)
  if (result.loading) return <Loading label="Đang đọc manifest…" />
  if (result.error) return <Notice title="Không đọc được bản xem trước" tone="error">
    {shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button>
  </Notice>
  return result.data && <DesignPreviewContent design={design} manifest={result.data} />
}
