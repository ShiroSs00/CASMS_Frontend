# Port-location catalogue

Source: [official UNECE UN/LOCODE 2025-1 publication](https://unlocode.unece.org/publications/), downloaded 2026-10-21 from the `2025-1` package-release artifact linked there. UNECE publishes its standards under CC BY 4.0; preserve this attribution when redistributing the derived catalogue.

`asia-port-locations.json` contains 28 curated UN/LOCODE tourism/exploration gateways with function position 1 set, excluding deleted entries (`Change=X`, `Status=XX`), in exactly VN, SG, MY, TH, PH, CN and JP. The earlier exhaustive 3,093-location list was reduced at the user's request. A location can be a city, terminal or port facility: this is not a list of every municipality, nor proof of present cruise passenger facilities.

Country labels are localized through `Intl.DisplayNames`. Source location names and codes are preserved. `label` is a friendly editorial name; `searchName` is a city/island-name alias used for geocoding (for example `Phuket` rather than `Phuket Port`). The original locality may have several terminals; this selector does not choose an exact berth.

Curation references (consulted 2026-10-21): [NCL port directory](https://www.ncl.com/cruise-ports), [Royal Caribbean Asia](https://www.royalcaribbean.com/asia-cruises), [Princess Japan ports](https://www.princesscruises.jp/destinations/japan), and [Vietnam Tourism — island hopping in Phu Quoc](https://vietnam.travel/things-to-do/island-hopping-in-phu-quoc). [Tourism Malaysia — Kuah](https://ebrochures.malaysia.travel/en/langkawi/5-your-first-stop-kuah/) supports using Kuah as the Langkawi search locality. This is an editorial shortlist for exploration rather than an objective popularity ranking.

Regenerate from the official release archive:

```powershell
./scripts/build-asia-port-catalog.ps1 -ArchivePath C:/path/to/unlocode-2025-1.zip
```

City coordinates are separately queried from [Open-Meteo geocoding / GeoNames](https://open-meteo.com/en/docs/geocoding-api). The query uses an explicit ISO country filter and accepts populated places and islands with validated coordinates/timezone. Results are locality references, not surveyed berth positions. Searches are explicit, cancellable and cached in memory; errors preserve entered data. The public endpoint is for non-commercial use; configure `VITE_GEOCODING_API_URL` for another compatible endpoint if necessary. Do not put private API keys in public Vite variables.
