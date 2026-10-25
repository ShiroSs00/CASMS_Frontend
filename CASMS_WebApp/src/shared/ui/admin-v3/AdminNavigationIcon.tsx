/** Decorative navigation cues. Labels and permission filtering remain authoritative. */
export function AdminNavigationIcon({ section }: { section: string }) {
  const paths: Record<string, string> = {
    fleet: 'M3 17l9 4 9-4-2-7H5l-2 7zm4-7V5h10v5M10 5V2m-7 20 4-1 5 1 5-1 4 1',
    schedule: 'M5 5h14v16H5zM8 2v6m8-6v6M5 11h14m-10 4h2m3 0h2',
    bookings: 'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h4',
    locations: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0zm-7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    operations: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4zm-4 10 3 3 5-6',
    services: 'M4 10h16v11H4zM2 6h20v4H2zm10 0v15M12 6C5 6 5 0 9 2l3 4zm0 0c7 0 7-6 3-4l-3 4',
    experiences: 'M12 3l3 6 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1 3-6z',
    system: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-3a8 8 0 0 1 16 0v3',
    model: 'M12 2l9 5v10l-9 5-9-5V7l9-5zm0 10 9-5M12 12 3 7m9 5v10',
    dashboard: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  }
  const kind = section.includes('model') || section.includes('import') ? 'model'
    : section.includes('dashboard') ? 'dashboard'
    : section.includes('tracking') ? 'locations'
    : section.includes('staff') ? 'bookings'
    : ['ships', 'decks', 'cabins'].includes(section) ? 'fleet'
    : ['destinations', 'ports', 'suppliers'].includes(section) ? 'locations'
    : ['cruises', 'itineraries'].includes(section) ? 'schedule'
    : ['issues', 'regulations'].includes(section) ? 'operations' : section
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind] ?? paths.dashboard} /></svg>
}
