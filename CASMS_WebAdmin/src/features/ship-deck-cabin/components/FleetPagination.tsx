import {Button,ListFooter} from '@/shared/ui'
import type {paginateFleet} from '../model/fleet-pagination'
export function FleetPagination({pagination,onChange}:{pagination:ReturnType<typeof paginateFleet>;onChange:(page:number)=>void}) {
  const {page,pages,start,end,total}=pagination
  if(!total)return null
  const numbers=Array.from(new Set([1,...Array.from({length:5},(_,i)=>page+i-2).filter(n=>n>1&&n<pages),pages])).sort((a,b)=>a-b)
  return <ListFooter summary={`${start}–${end} / ${total} tàu`}>
    <Button tone="secondary" size="compact" autoWidth disabled={page===1} onClick={()=>onChange(page-1)}>← Trước</Button>
    {numbers.map((number,index)=><span key={number}>{index>0&&number-numbers[index-1]>1&&<span aria-hidden="true"> … </span>}<Button tone={number===page?'primary':'secondary'} size="compact" autoWidth aria-label={`Trang ${number}`} aria-current={number===page?'page':undefined} onClick={()=>onChange(number)}>{number}</Button></span>)}
    <Button tone="secondary" size="compact" autoWidth disabled={page===pages} onClick={()=>onChange(page+1)}>Sau →</Button>
  </ListFooter>
}
