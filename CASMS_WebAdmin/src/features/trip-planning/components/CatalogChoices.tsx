import { Button, Loading, Notice } from '@/shared/ui'
import { useSources } from '../hooks'
import styles from '../Planning.module.css'

export function CatalogChoices({catalog,values,onChange}:{catalog:ReturnType<typeof useSources>;values:string[];onChange:(values:string[])=>void}){
  if(catalog.loading)return <Loading label="Đang tải danh mục…"/>
  if(catalog.error)return <Notice title="Chưa tải được danh mục" tone="error">{catalog.error}<Button type="button" tone="secondary" onClick={catalog.retry}>Thử lại</Button></Notice>
  const known=new Set(catalog.data.map(item=>item.id))
  const options=[...catalog.data,...values.filter(value=>!known.has(value)).map(id=>({id,label:`${id} · Đã lưu`}))]
  return <div className={styles.checks}>
    {options.map(option=><label key={option.id}><input type="checkbox" checked={values.includes(option.id)} onChange={()=>onChange(values.includes(option.id)?values.filter(id=>id!==option.id):[...values,option.id])}/>{option.label}</label>)}
    {!options.length&&<span>Danh mục hiện chưa có lựa chọn.</span>}
  </div>
}
