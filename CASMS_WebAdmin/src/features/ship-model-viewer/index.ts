export const loadModelViewerPage = () => import('./ModelViewerPage')
export const loadShipImportPage = () => import('./import/ShipImportPage')
export const loadPassengerTrackingPage = () => import('./PassengerTrackingPage')
export const loadCustomerShipExplorer = () => import('./CustomerShipExplorer')

export const loadModelCanvas = () => import('./ModelCanvas')
export const inspectBundle = (file: File) => import('./import/bundle-manifest').then(module => module.readBundleManifest(file))
export const fingerprintPreview = (value: unknown) => import('./import/preview-proof').then(module => module.previewFingerprint(value))
