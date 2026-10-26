import { useState } from 'react'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import type { Source } from '../model/plan'
import styles from '../Planning.module.css'

type Props={id:string;label:string;placeholder:string;emptyMessage:string;value:string;selectedLabel?:string;selectedSource?:Source;options:Source[];loading:boolean;loadError:string;error?:string;readOnly:boolean;retry:()=>void;onBlur:()=>void;onChange:(id:string)=>void;searchValue?:string;onSearch?:(value:string)=>void;filtered?:boolean}
const searchable=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim()

/** Uses server keyword filtering when supplied; otherwise searches the loaded array. */
export function SourcePicker({id,label,placeholder,emptyMessage,value,selectedLabel,selectedSource,options,loading,loadError,error,readOnly,retry,onBlur,onChange,searchValue,onSearch,filtered=false}:Props){
  const [search,setSearch]=useState('')
  const query=searchable(searchValue??search),matches=onSearch?options:options.filter(option=>searchable(option.label).includes(query))
  const selected=options.find(option=>option.id===value)??(selectedSource?.id===value?selectedSource:undefined),keepSelection=Boolean(value&&!matches.some(option=>option.id===value))
  return <div className={styles.sourcePicker}>
    {!readOnly&&(onSearch||options.length>0)&&<Field htmlFor={`${id}-search`} label={onSearch?'Tìm theo tên hoặc mã':'Tìm trong danh mục'}><input id={`${id}-search`} type="search" value={searchValue??search} placeholder="Nhập tên hoặc mã" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}} onChange={event=>onSearch?onSearch(event.target.value):setSearch(event.target.value)}/></Field>}
    <Field htmlFor={id} label={label} error={error}><select id={id} value={value} disabled={readOnly||loading||Boolean(loadError)||!options.length} aria-invalid={Boolean(error)} aria-describedby={`${id}-status`} onBlur={onBlur} onChange={event=>onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {keepSelection&&<optgroup label="Đang chọn"><option value={value}>{selected?.label??selectedLabel??'Mục đã lưu'}{!selected&&!loading&&!filtered&&!query?' · không có trong danh mục hiện tại':''}</option></optgroup>}
      {matches.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
    </select></Field>
    <div id={`${id}-status`} aria-live="polite">
      {loading?<Loading label="Đang tải danh mục…"/>:loadError?<Notice title="Chưa tải được danh mục" tone="error">{loadError}<Button type="button" tone="secondary" onClick={retry}>Tải lại danh mục</Button></Notice>:!options.length&&!query&&!filtered?<Notice title="Chưa có dữ liệu để chọn">{emptyMessage}<Button type="button" tone="secondary" onClick={retry}>Tải lại danh mục</Button></Notice>:<p className={styles.muted}>{matches.length?`${matches.length} lựa chọn`:'Không tìm thấy kết quả. Thử từ khóa hoặc bộ lọc khác.'}</p>}
      {value&&!selected&&!loading&&!loadError&&!filtered&&!query&&<p className={styles.error}>{readOnly?'Mục đã lưu không còn trong danh mục hiện tại. Nội dung lịch trình vẫn được giữ.':'Mục đã lưu không còn trong danh mục hiện tại. Chọn lại mục hợp lệ trước khi áp dụng.'}</p>}
    </div>
  </div>
}
