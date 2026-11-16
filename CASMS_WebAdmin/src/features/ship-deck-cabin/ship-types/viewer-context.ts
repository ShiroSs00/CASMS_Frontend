import { createContext, type ComponentType } from 'react'

export type ShipPreviewProps = { file: string; sourcePath: string }

export const ShipViewerContext = createContext<{
  PreviewCanvas: ComponentType<ShipPreviewProps>
  RecordViewer: ComponentType<{ ship: string }>
  readBundle: (file: File) => Promise<{ modelKey: string }>
  fingerprint: (value: unknown) => Promise<string>
} | null>(null)
