export function ShipAreaCount({count}:{count?:number}) {
  return <div><dt>Khu vực dịch vụ</dt><dd>{count??<span aria-label="Chưa có số liệu khu vực dịch vụ">—</span>}</dd></div>
}
