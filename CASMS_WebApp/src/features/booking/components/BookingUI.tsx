import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { Button, ButtonLink, Field, Panel as SharedPanel } from '@/shared/ui'
import type { ActionResult } from '../model/booking-types'
import s from './Booking.module.css'
export function Action(props:ButtonHTMLAttributes<HTMLButtonElement>&{secondary?:boolean}) { const {secondary,className='',...rest}=props;return <Button {...rest} tone={secondary?'secondary':'primary'} className={s.button+' '+(secondary?s.secondary:'')+' '+className}/> }
export function ActionLink({to,children,secondary=false}:{to:string;children:ReactNode;secondary?:boolean}) {return <ButtonLink to={to} tone={secondary?'secondary':'primary'} className={s.button+' '+(secondary?s.secondary:'')}>{children}</ButtonLink>}
export function Panel({title,children,className='',id}:{title?:string;children:ReactNode;className?:string;id?:string}) {return <SharedPanel id={id} title={title} className={s.panel+' '+className}>{children}</SharedPanel>}
export function Heading({title,description,large=false,level=1}:{title:string;description?:string;large?:boolean;level?:1|2}) {const Tag=level===1?'h1':'h2';return <div className={s.heading}><Tag className={large?s.large:''}>{title}</Tag>{description&&<p>{description}</p>}</div>}
export function FieldInput({label,error,...props}:InputHTMLAttributes<HTMLInputElement>&{id:string;label:string;error?:string}) {return <div className={s.field}><Field htmlFor={props.id} label={label} error={error}><input {...props} aria-invalid={!!error} aria-describedby={error?props.id+'-hint':undefined}/></Field></div>}
export function Feedback({result,pending}:{result:ActionResult|null;pending:boolean}) {return pending?<p role="status" className={s.notice}>Đang xử lý…</p>:result?<p role={result.state==='received'?'status':'alert'} className={s.notice}>{result.message}{result.state==='received'&&result.reference&&<> Mã tiếp nhận: <strong>{result.reference}</strong></>}</p>:null}
export function EmptyState({title,children}:{title:string;children?:ReactNode}) {return <div className={s.empty}><h2>{title}</h2>{children}</div>}
export function Steps({active}:{active:number}) {return <ol className={s.steps}>{['Người đi','Cabin & gói','Kiểm tra','Thanh toán'].map((label,i)=><li key={label} className={active===i+1?s.active:''} aria-current={active===i+1?'step':undefined}>{i+1} {label}</li>)}</ol>}
export function Badge({children,warning=false}:{children:ReactNode;warning?:boolean}) {return <span className={s.badge+' '+(warning?s.warning:'')}>{children}</span>}

