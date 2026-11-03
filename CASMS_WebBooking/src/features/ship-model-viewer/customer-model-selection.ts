export function mapBookingCabins(
  cabins: Array<{ cabinId: string; remainingCapacity: number }>,
  mappings: Array<{ modelId: string; cabinId: string }>,
  modelCabins: Array<{ id: string; modelId?: string; nodeName: string }>,
) {
  return cabins.flatMap(cabin => {
    const links = mappings.filter(value => value.cabinId === cabin.cabinId)
    if (links.length !== 1) return []
    const targets = modelCabins.filter(value => value.id === links[0].modelId || value.modelId === links[0].modelId || value.nodeName === links[0].modelId)
    if (targets.length !== 1 || mappings.filter(value => value.modelId === links[0].modelId).length !== 1) return []
    return [{ ...cabin, nodeName: targets[0].nodeName }]
  })
}
