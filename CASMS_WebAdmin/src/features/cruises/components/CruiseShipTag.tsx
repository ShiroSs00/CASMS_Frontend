import { UNASSIGNED_SHIP_LABEL } from '../model/ship-grouping'
import styles from './Cruises.module.css'

const SHIP_TONE_CLASSES = [
  styles.shipTagNavy,
  styles.shipTagTeal,
  styles.shipTagSand,
  styles.shipTagSlate,
  styles.shipTagSage,
] as const

function hashShipKey(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function ShipHullIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? styles.shipTagIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5L8 6.5l5 2-1.2 4.2a1 1 0 0 1-.96.73H5.16a1 1 0 0 1-.96-.73L3 8.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5.5 6.9V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.4M8 3.5V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function CruiseShipTag({ shipName }: { shipName?: string | null }) {
  const trimmed = shipName?.trim()
  if (!trimmed) {
    return (
      <span className={`${styles.shipTag} ${styles.shipTagMuted}`}>
        <ShipHullIcon />
        <span>{UNASSIGNED_SHIP_LABEL}</span>
      </span>
    )
  }
  const toneClass = SHIP_TONE_CLASSES[hashShipKey(trimmed) % SHIP_TONE_CLASSES.length]
  return (
    <span className={`${styles.shipTag} ${toneClass}`} title={trimmed}>
      <ShipHullIcon />
      <span>{trimmed}</span>
    </span>
  )
}
