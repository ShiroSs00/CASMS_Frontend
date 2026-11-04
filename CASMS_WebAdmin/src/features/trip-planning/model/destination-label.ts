/** The catalog stores these labels as regions. A visit uses the place name. */
export function destinationVisitLabel(name: string): string {
  switch (name.trim()) {
    case 'Đà Nẵng & Miền Trung': return 'Đà Nẵng'
    case 'Vịnh Hạ Long & Bắc Bộ': return 'Vịnh Hạ Long'
    default: return name
  }
}
