// Synthetic responses only. This fixture cannot establish Backend inventory or E2E acceptance.
export function installBookingFixture(initialMode = 'normal') {
  const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const cruiseId = id(1), shipId = id(2)
  const cruise = { cruiseId, shipId, cruiseCode: 'UI-TEST', cruiseName: 'Hải trình thử nghiệm OceVie · Singapore và Vịnh Hạ Long', shipName: 'OceVie Test', cruiseType: 'MULTI_DAYS', status: 'PUBLISHED', departureDatetime: '2099-06-01T03:00:00Z', returnDatetime: '2099-06-04T03:00:00Z', departurePortName: 'Singapore', returnPortName: 'Vịnh Hạ Long' }
  const cabins = [3, 4].map((n, i) => ({ cabinId: id(n), cabinNumber: `80${i + 1}`, deckId: id(5), deckNumber: 8, deckName: 'Boong 8', cabinType: 'BALCONY', capacity: 2, remainingCapacity: 2, isAccessible: i === 0 }))
  const selection = n => ({ offerId: id(n), templateVersionId: id(7), priceRevisionId: id(n + 10), shipId, logicalCategoryId: id(8), cabinMappingId: id(9), physicalCabinIds: cabins.map(c => c.cabinId), logicalCategory: 'Ban công', cabinType: 'BALCONY', amount: n === 6 ? '100' : '120', templateName: n === 6 ? 'Khám phá' : 'Trọn trải nghiệm', templateDescription: null, templateVersionNumber: 1, priceRevisionNumber: 1, commercialRevision: 1, benefits: [] })
  const catalog = { cruiseId, fareManaged: true, offers: [6, 16].map(n => ({ cruiseId, selection: selection(n), currencyCode: 'USD', priceUnit: 'PERSON' })) }
  const secondCruise = { ...cruise, cruiseId: id(50), cruiseName: 'Hành trình OceVie · Singapore và nhiều điểm đến Đông Nam Á' }
  const fixture = window.__bookingFixture = { mode: initialMode, cruiseId, calls: [], quote: null, createCount: 0, quoteCount: 0, catalog, cabins, saved: null }
  const original = window.fetch.bind(window)
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    if (!url.pathname.startsWith('/api/')) return original(input, options)
    const path = url.pathname.slice(4), method = options.method ?? 'GET'
    const body = options.body ? JSON.parse(options.body) : null
    fixture.calls.push({ path, method, body, headers: options.headers })
    const ok = data => Promise.resolve(Response.json({ success: true, data }))
    const fail = (status, code) => Promise.resolve(Response.json({ success: false, code }, { status }))
    if (fixture.mode.startsWith('detail-') && path.startsWith('/cruise')) {
      const mode = fixture.mode
      const target = path.split('/')[2] === secondCruise.cruiseId ? secondCruise : cruise
      if (path === '/cruise') {
        return ok({ content: [cruise, secondCruise], number: Number(url.searchParams.get('page') ?? 0), totalPages: 3, totalElements: 14 })
      }
      if (path === `/cruise/${target.cruiseId}`) {
        if (mode === 'detail-forbidden') return fail(403, 'ACCESS_DENIED')
        if (mode === 'detail-not-found') return fail(404, 'NOT_FOUND')
        await new Promise(resolve => setTimeout(resolve, 250))
        if (mode === 'detail-missing-ship') return ok({ ...target, shipId: null, shipName: null })
        return ok(target)
      }
      if (path.endsWith('/sellability')) {
        if (mode === 'detail-sale-error') return fail(503, 'TEST_UNAVAILABLE')
        const sellable = mode !== 'detail-sold-out'
        const saleState = sellable ? 'OPEN_FOR_SALE' : 'SOLD_OUT'
        return ok({ cruiseId: target.cruiseId, sellable, transactionReady: sellable && mode !== 'detail-read-only', saleState, publicDisplayEligible: sellable, publicSaleState: saleState, openedForSaleAt: '2026-11-01T00:00:00Z', evaluatedAt: new Date().toISOString() })
      }
      if (path.endsWith('/public-itinerary')) {
        if (mode === 'detail-itinerary-error') throw new TypeError('Synthetic itinerary network failure')
        if (mode === 'detail-itinerary-pending') return fail(409, 'PUBLIC_ITINERARY_UNAVAILABLE')
        if (mode === 'detail-revoked') return fail(409, 'CRUISE_NOT_OPEN_FOR_SALE')
        const days = [
          { dayNumber: 1, date: '2099-06-01', shipTimeZoneId: 'Asia/Ho_Chi_Minh', portCalls: [
            { sequence: 1, portName: 'Singapore', countryCode: 'SG', portTimeZoneId: 'Asia/Singapore', arrival: '2099-05-31T15:30:00Z', departure: '2099-06-01T03:00:00Z', destinationVisits: [{ sequence: 1, destinationName: 'Marina Bay' }, { sequence: 2, destinationName: 'Gardens by the Bay' }] },
            { sequence: 2, portName: null, countryCode: null, portTimeZoneId: 'Asia/Ho_Chi_Minh', arrival: '2099-06-01T04:00:00Z', departure: '2099-06-01T08:00:00Z', destinationVisits: [{ sequence: 1, destinationName: null }] },
          ] },
          { dayNumber: 2, date: '2099-06-02', shipTimeZoneId: 'Asia/Ho_Chi_Minh', portCalls: [] },
        ]
        return ok({ cruiseId: mode === 'detail-invalid-itinerary' ? id(99) : target.cruiseId, departureDatetime: target.departureDatetime, returnDatetime: target.returnDatetime, durationDays: null, durationNights: 0, days: mode === 'detail-empty-itinerary' ? [] : days })
      }
      if (path.endsWith('/cruise-package-offers/available')) {
        if (mode === 'detail-package-error') return fail(503, 'TEST_UNAVAILABLE')
        const benefit = { sourceBenefitId: id(55), serviceId: id(56), inclusion: 'LIMITED_INCLUDED', quantityLimit: 1, usageUnit: 'PARTICIPATION', requiresReservation: true, eligibility: 'Áp dụng theo lịch phục vụ', resourceName: 'Bữa tối trên tàu', occurrences: [] }
        const offers = catalog.offers.map((offer, index) => ({
          ...offer, cruiseId: target.cruiseId,
          selection: { ...offer.selection, benefits: index === 0 ? [benefit] : [] },
        }))
        return ok({ ...catalog, cruiseId: target.cruiseId, offers })
      }
    }
    if (path.includes('/public-model/')) return fail(404, 'MODEL_NOT_FOUND')
    if (path === '/cruise') {
      if (fixture.mode === 'discoveryError') return fail(503, 'TEST_UNAVAILABLE')
      const empty = fixture.mode === 'empty'
      return ok({ content: empty ? [] : [cruise], number: Number(url.searchParams.get('page') ?? 0), totalPages: empty ? 0 : 1, totalElements: empty ? 0 : 1 })
    }
    if (path === `/cruise/${cruiseId}`) return ok(cruise)
    if (path.endsWith('/sellability')) return ok({ cruiseId, sellable: fixture.mode !== 'soldOut', transactionReady: fixture.mode !== 'soldOut', saleState: fixture.mode === 'soldOut' ? 'SOLD_OUT' : 'OPEN_FOR_SALE', publicDisplayEligible: fixture.mode !== 'soldOut', publicSaleState: fixture.mode === 'soldOut' ? 'SOLD_OUT' : 'OPEN_FOR_SALE', openedForSaleAt: '2026-11-01T00:00:00Z', evaluatedAt: new Date().toISOString() })
    if (path.endsWith('/public-itinerary')) return ok({ cruiseId, departureDatetime: cruise.departureDatetime, returnDatetime: cruise.returnDatetime, durationDays: 4, durationNights: 3, days: [] })
    if (path.endsWith('/cruise-package-offers/available')) return ok(fixture.catalog)
    if (path === '/booking/available-cabins') return ok(fixture.cabins)
    if (path.endsWith('/packages') && path.startsWith('/cruise/')) return ok([])
    if (path === '/servicepackage/packages') return ok([])
    if (path === '/booking/quotes' && method === 'POST') {
      fixture.quoteCount++
      if (fixture.mode === 'quoteUnknown') throw new TypeError('Synthetic lost quote response')
      if (fixture.mode === 'knownRejection') return fail(409, 'FARE_QUOTED_PRICE_STALE')
      await new Promise(resolve => setTimeout(resolve, 150))
      fixture.quote = { quoteId: id(20), cruiseId, currency: 'USD', paymentPlan: body.paymentPlan, status: 'ACTIVE', expiresAt: new Date(Date.now() + (fixture.mode === 'expiry' ? 1200 : 600000)).toISOString(), policyVersion: 'ui-test-1', fingerprint: 'synthetic-fingerprint', totalAmount: body.passengers.reduce((sum, p) => sum + (p.farePackageOfferId ? Number(catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId).selection.amount) : 100), 0),
        lineItems: body.passengers.map(p => ({ cabinId: p.cabinId, cabinNumber: p.cabinId ? cabins.find(c => c.cabinId === p.cabinId)?.cabinNumber : null, cabinType: 'BALCONY', deckNumber: p.cabinId ? 8 : null, tourPackageId: p.tourPackageId ?? null, cabinSelectionMode: p.cabinSelectionMode ?? null, cabinGroupKey: p.cabinGroupKey || (p.farePackageOfferId ? (p.cabinSelectionMode === 'CATEGORY_HOLD' ? 'BOOKING_GROUP' : 'CABIN:' + p.cabinId) : null), fareSelection: p.farePackageOfferId ? catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId).selection : null, itemTotal: p.farePackageOfferId ? Number(catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId).selection.amount) : 100 })) }
      return ok({ ...fixture.quote, guestToken: 'synthetic-token-not-a-real-credential' })
    }
    if (path.startsWith('/booking/quotes/')) return ok(fixture.quote)
    if (path === '/booking' && method === 'POST') {
      fixture.createCount++
      await new Promise(resolve => setTimeout(resolve, 150))
      if (fixture.mode === 'bookingUnknown') throw new TypeError('Synthetic lost create response')
      fixture.saved = { bookingId: id(21), bookingReference: 'UI-TEST-REF', cruiseId, cruiseName: cruise.cruiseName, bookingStatus: 'Draft', agreedFareAmount: fixture.quote.totalAmount, requiredDepositAmount: 0, currency: 'USD', installments: [], paymentPlan: body.paymentPlan, contractStatus: 'Draft', departureDatetime: cruise.departureDatetime, returnDatetime: cruise.returnDatetime,
        passengers: body.passengers.map((p, i) => ({ ...p, bookingPassengerId: id(30 + i), passengerId: id(40 + i), participationStatus: 'Active', cabinNumber: p.cabinId ? cabins.find(c => c.cabinId === p.cabinId)?.cabinNumber : null, fareCabinCategory: p.farePackageOfferId ? 'BALCONY' : null, selectedFare: p.farePackageOfferId ? catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId).selection : null, canSelectFareCabin: false })) }
      return ok(fixture.saved)
    }
    if (path === '/booking/lookup') return fixture.saved ? ok(fixture.saved) : fail(404, 'NOT_FOUND')
    return fail(404, 'UI_FIXTURE_NOT_DEFINED')
  }
}
