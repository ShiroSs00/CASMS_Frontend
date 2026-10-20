import { useParams, useSearchParams } from 'react-router'
import { LiveCruiseSearch, LiveCruiseDetail } from '../components/LiveCruiseCatalog'
import { CruiseDetail } from '../components/CruiseDiscovery'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function CruiseSearchPage() {
  return <LiveCruiseSearch />
}

export function CustomerCruiseDetailPage() {
  const { cruiseId } = useParams()
  const [params] = useSearchParams()
  const isLive = Boolean(params.get('catalog') === 'live' || (cruiseId && UUID_REGEX.test(cruiseId)))

  if (isLive) {
    return <LiveCruiseDetail />
  }
  return <CruiseDetail />
}
