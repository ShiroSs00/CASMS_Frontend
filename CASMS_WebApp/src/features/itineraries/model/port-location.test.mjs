import assert from 'node:assert/strict'
import test from 'node:test'
import { countryPortLocations, decodeGeocoding, geocodingUrl, portCountries, portLocations } from './port-location.ts'

test('catalog contains unique official port locations filtered by country', () => {
  assert.equal(new Set(portLocations.map(item => item.code)).size, portLocations.length)
  assert.equal(portLocations.length, 28)
  assert.deepEqual(portCountries.map(item => item.code).sort(), ['CN', 'JP', 'MY', 'PH', 'SG', 'TH', 'VN'])
  const vietnam = countryPortLocations('VN')
  assert.ok(vietnam.some(item => item.code === 'VNHLG' && item.label === 'Hạ Long'))
  assert.ok(!vietnam.some(item => item.code === 'VNHPH'))
  assert.ok(portCountries.every(country => countryPortLocations(country.code).length <= 6))
  assert.ok(vietnam.every(item => item.country === 'VN'))
  assert.equal(countryPortLocations('US').length, 0)
  assert.ok(portCountries.some(item => item.code === 'JP' && item.name))
})
test('search filters by country and encodes a Unicode city name', () => {
  const url = new URL(geocodingUrl('https://geocoding-api.open-meteo.com/v1/search', ' Hải Phòng ', 'VN'))
  assert.equal(url.searchParams.get('name'), 'Hải Phòng')
  assert.equal(url.searchParams.get('countryCode'), 'VN')
  assert.throws(() => geocodingUrl(url.origin, '', 'VN'))
  assert.throws(() => geocodingUrl(url.origin, 'Paris', 'FR'))
})
const place = { id: 1581298, name: 'Hải Phòng', feature_code: 'PPLA', country_code: 'VN', latitude: 20.86481, longitude: 106.68345, timezone: 'Asia/Bangkok', admin1: 'Hải Phòng' }
test('decoder maps real geocoding fields and excludes another country', () => {
  const result = decodeGeocoding({ results: [place, { ...place, country_code: 'CN' }, { ...place, feature_code: 'AIRP' }, { ...place, feature_code: 'PCLI' }] }, 'VN')
  assert.equal(result.length, 1)
  assert.equal(result[0].latitude, 20.86481)
  assert.equal(result[0].longitude, 106.68345)
  assert.equal(result[0].timeZoneId, 'Asia/Bangkok')
  assert.equal(result[0].kind, 'CITY')
  assert.deepEqual(decodeGeocoding({}, 'VN'), [])
})
test('tourism islands such as Boracay are accepted and identified separately from cities', () => {
  assert.equal(decodeGeocoding({ results: [{ ...place, feature_code: 'ISL' }] }, 'VN')[0].kind, 'ISLAND')
  assert.equal(countryPortLocations('MY').find(item => item.code === 'MYLGK').searchName, 'Kuah')
})
test('decoder rejects provider errors, malformed coordinates and invalid timezone', () => {
  for (const value of [null, [], { error: true }, { results: 'bad' }, { results: [{ ...place, latitude: 91 }] }, { results: [{ ...place, longitude: '106' }] }, { results: [{ ...place, timezone: 'Invalid/Timezone' }] }]) assert.throws(() => decodeGeocoding(value, 'VN'))
  assert.equal(decodeGeocoding({ results: [{ ...place, latitude: 0, longitude: 0 }] }, 'VN')[0].latitude, 0)
})
