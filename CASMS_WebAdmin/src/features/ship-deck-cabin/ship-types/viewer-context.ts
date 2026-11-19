import { createContext, type ComponentType } from 'react'

export const ShipViewerContext = createContext<{
  RecordViewer: ComponentType<{ ship: string }>
  readBundle: (file: File) => Promise<{ modelKey: string }>
  fingerprint: (value: unknown) => Promise<string>
} | null>(null)
