// Local UI fixture only. No real credentials, database or upstream requests.
import { createServer } from 'node:http'
import { URL } from 'node:url'
import process from 'node:process'
const requests = []
const ships = [
  { shipId: 's1', shipCode: 'SH-0001', shipName: 'Carnival Conquest', status: 'ACTIVE', totalCapacity: 610, totalDecks: 13, deckNumberLimit: 14, manifestModelId: 'conquest', lengthMeters: 290.17, beamMeters: 35.36, commissionDate: null, updatedAt: '2026-10-24T00:00:00Z' },
  { shipId: 's2', shipCode: 'SH-0002', shipName: 'Zaandam', status: 'MAINTENANCE', totalCapacity: 582, totalDecks: 10, deckNumberLimit: 10, manifestModelId: 'zaandam', lengthMeters: 237, beamMeters: 32, commissionDate: null },
]
const decks = [{ deckId: 'd1', shipId: 's1', deckNumber: 1, deckName: 'Riviera', priceMultiplier: 1 }, { deckId: 'd14', shipId: 's1', deckNumber: 14, deckName: 'Sun', priceMultiplier: 1.25 }, { deckId: 'z1', shipId: 's2', deckNumber: 1, deckName: 'Dolphin', priceMultiplier: 1 }]
const rooms = Array.from({ length: 46 }, (_, i) => ({ cabinId: `r${i}`, shipId: 's1', deckId: i % 2 ? 'd14' : 'd1', cabinNumber: `C${i % 2 ? '14' : '01'}-${String(i + 1).padStart(3, '0')}`, cabinType: i % 3 ? 'INTERIOR' : 'SUITE', capacity: 2, isAccessible: i % 5 === 0, status: i === 1 ? 'OCCUPIED' : i === 2 ? 'MAINTENANCE' : 'AVAILABLE', modelWidth: 5, modelHeight: 2.8, modelDepth: 6 }))
rooms.push({ cabinId: 'zr1', shipId: 's2', deckId: 'z1', cabinNumber: 'Z01-001', cabinType: 'BALCONY', capacity: 2, isAccessible: true, status: 'AVAILABLE' })
const permissions = 'SHIP_READ SHIP_CREATE SHIP_UPDATE SHIP_STATUS_CHANGE SHIP_CAPACITY_SUMMARY SHIP_CURRENT_CRUISE SHIP_READINESS SHIP_VALIDATE SHIP_SCHEDULE_CHECK SHIP_AFFECTED_CRUISES SHIP_DELETE DECK_READ DECK_UPDATE DECK_CREATE CABIN_READ CABIN_UPDATE CABIN_CREATE CABIN_BLOCK CABIN_RELEASE CABIN_STATUS_CHANGE PORT_READ DESTINATION_READ CRUISE_READ REGULATION_READ'.split(' ')
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace(/^\/api/, '')
  let raw = ''; for await (const chunk of req) raw += chunk.toString()
  const body = raw ? JSON.parse(raw) : null
  if (!path.startsWith('/auth/')) requests.push({ path, method: req.method, body })
  const reply = (data, status = 200, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: status < 400, data, message })) }
  const paged = rows => reply({ content: rows, number: 0, totalPages: rows.length ? 1 : 0, totalElements: rows.length })
  if (path === '/__qa/stats') return reply(requests)
  if (path === '/auth/login' || path === '/auth/refresh') return reply({ accessToken: 'fleet-ui-fixture', userId: 'fleet-fixture', username: 'fleet-fixture', tokenType: 'Bearer', expiresIn: 3600, roles: ['SHIP_MANAGER'] })
  if (path === '/auth/me') return reply({ userId: 'fleet-fixture', effectivePermissions: permissions })
  if (path === '/ships') return paged(ships)
  const shipId = path.split('/')[2], ship = ships.find(item => item.shipId === shipId)
  if (path === `/ships/${shipId}` && ship) { if (req.method === 'PATCH') Object.assign(ship, body); return reply(ship) }
  if (path.endsWith('/capacity-summary') && ship) return reply({ configuredTotalCapacity: ship.totalCapacity, configuredTotalDecks: ship.totalDecks, actualDeckCount: decks.filter(deck => deck.shipId === shipId).length, actualCabinCount: rooms.filter(room => room.shipId === shipId).length, availableCabinCount: rooms.filter(room => room.shipId === shipId && room.status === 'AVAILABLE').length })
  if (path.endsWith('/readiness')) return reply(ship?.status === 'ACTIVE')
  if (path.endsWith('/current-cruise')) return reply(null, 404, 'No active cruise found for ship currently')
  if (path.endsWith('/status') && ship) { ship.status = url.searchParams.get('status'); return reply(ship) }
  if (path.startsWith('/decks/by-ship/')) return paged(decks.filter(deck => deck.shipId === path.split('/')[3]))
  if (path.startsWith('/cabins/by-ship/')) return paged(rooms.filter(room => room.shipId === path.split('/')[3]))
  const deck = decks.find(item => path === `/decks/${item.deckId}`)
  if (deck && req.method === 'PATCH') { if ('deckNumber' in body) return reply(null, 400, 'Deck identity should not be sent'); Object.assign(deck, body); return reply(deck) }
  const room = rooms.find(item => path === `/cabins/${item.cabinId}` || path.startsWith(`/cabins/${item.cabinId}/`))
  if (room && req.method === 'PATCH') { if ('cabinType' in body || 'modelWidth' in body) return reply(null, 400, 'Model fields are immutable'); Object.assign(room, body); return reply(room) }
  if (room && path.endsWith('/block')) { room.status = url.searchParams.get('reasonStatus'); return reply(room) }
  if (room && path.endsWith('/release')) { room.status = 'AVAILABLE'; return reply(room) }
  return reply(null, 500, 'Unexpected fixture request: ' + req.method + ' ' + path)
}).listen(5189, '127.0.0.1', () => process.stdout.write('Fleet UI fixture :5189\n'))
