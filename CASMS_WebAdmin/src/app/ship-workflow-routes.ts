import { createElement, lazy } from 'react'
import { inspectBundle, fingerprintPreview, loadModelViewerPage } from '@/features/ship-model-viewer'

const RecordViewer = lazy(async () => ({ default: (await loadModelViewerPage()).ShipRecordViewer }))
const viewerComponents = { RecordViewer, readBundle: inspectBundle, fingerprint: fingerprintPreview }

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
