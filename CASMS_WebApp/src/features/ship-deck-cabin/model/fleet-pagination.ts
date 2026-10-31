export const SHIPS_PER_PAGE = 5
export function paginateFleet<T>(items:readonly T[],requested:number,pageSize=SHIPS_PER_PAGE) {
  const pages=Math.max(1,Math.ceil(items.length/pageSize))
  const page=Math.min(pages,Math.max(1,Number.isFinite(requested)?Math.floor(requested):1))
  const offset=(page-1)*pageSize
  return {page,pages,items:items.slice(offset,offset+pageSize),start:items.length?offset+1:0,end:Math.min(offset+pageSize,items.length),total:items.length}
}
