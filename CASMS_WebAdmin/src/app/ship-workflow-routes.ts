import { createElement, lazy } from 'react'
import { inspectBundle, fingerprintPreview, loadModelCanvas, loadModelViewerPage } from '@/features/ship-model-viewer'

const ignoredSelection = () => undefined
const PreviewCanvas = lazy(async () => {
  const { ModelCanvas } = await loadModelCanvas()
  return {
    default: function StoredModelCanvas(props: { file: string; sourcePath: string }) {
      return createElement(ModelCanvas, { ...props, ship: '', model: '', selected: '', onPick: ignoredSelection })
    },
  }
})
const RecordViewer = lazy(async () => ({ default: (await loadModelViewerPage()).ShipRecordViewer }))
const viewerComponents = { PreviewCanvas, RecordViewer, readBundle: inspectBundle, fingerprint: fingerprintPreview }

export function shipPageWithViewer(page: 'ShipDetailPage' | 'ShipTypeDetailPage' | 'ShipTypeDesignPage') {
  return async () => {
    const module = await import('@/features/ship-deck-cabin')
    const Page = module[page]
    const { ShipViewerContext } = module
    return { Component: function ShipPageWithViewer() {
      return createElement(ShipViewerContext, { value: viewerComponents }, createElement(Page))
    } }
  }
}
