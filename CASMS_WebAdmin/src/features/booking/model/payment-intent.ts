import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import type {Payment} from '../api/payment-api'

export type PaymentIntentPayload={bookingId:string;requestedAmount:number;currency:string;paymentMethod:string}
type Intent={payload:PaymentIntentPayload;key:string;status:'sending'|'unknown'}

export function paymentIntent(owner:string,bookingId:string,storage:Pick<Storage,'getItem'|'setItem'>) {
  const storageKey='ocvviet:payment-intent:v1:'+owner+':'+bookingId
  let current:Intent|null=null,storageError=false,inFlight:Promise<Payment>|null=null
  try {
    const raw=storage.getItem(storageKey)
    if(raw&&raw!=='null') {
      const saved=JSON.parse(raw) as Intent,p=saved?.payload
      if(!saved?.key||!['sending','unknown'].includes(saved.status)||p?.bookingId!==bookingId||!Number.isFinite(p.requestedAmount)||p.requestedAmount<=0||!/^[A-Z]{3}$/.test(p.currency)||!['Cash','GatewaySandbox'].includes(p.paymentMethod))throw Error('Invalid payment intent')
      current={...saved,status:'unknown'}
    }
  } catch {storageError=true}
  function persist(){try{storage.setItem(storageKey,JSON.stringify(current))}catch{storageError=true}}
  return {
    get record(){return current},get storageError(){return storageError},
    execute(payload:PaymentIntentPayload,send:(body:PaymentIntentPayload&{idempotencyKey:string})=>Promise<Payment>) {
      if(inFlight)return inFlight
      if(storageError||!owner||payload.bookingId!==bookingId)return Promise.reject(Error('Chưa lưu được mã yêu cầu thu tiền. Đối chiếu lịch sử trước khi tiếp tục.'))
      if(!Number.isFinite(payload.requestedAmount)||payload.requestedAmount<=0||!/^[A-Z]{3}$/.test(payload.currency)||!['Cash','GatewaySandbox'].includes(payload.paymentMethod))return Promise.reject(Error('Số tiền, tiền tệ hoặc phương thức thu chưa hợp lệ.'))
      if(current&&JSON.stringify(current.payload)!==JSON.stringify(payload))return Promise.reject(Error('Khoản thu trước chưa rõ kết quả. Chỉ gửi lại đúng nội dung và mã yêu cầu cũ.'))
      current=current?{...current,status:'sending'}:{payload:structuredClone(payload),key:crypto.randomUUID(),status:'sending'}
      persist()
      if(storageError)return Promise.reject(Error('Chưa lưu được mã yêu cầu; chưa gửi khoản thu.'))
      const intent=current
      inFlight=Promise.resolve().then(()=>send({...intent.payload,idempotencyKey:intent.key})).then(saved=>{
        if(saved.bookingId!==bookingId||saved.requestedAmount!==intent.payload.requestedAmount||saved.currency!==intent.payload.currency||saved.paymentMethod!==intent.payload.paymentMethod)throw Error('Phản hồi khoản thu không khớp yêu cầu. Đối chiếu lịch sử trước khi gửi lại.')
        current=null;persist();return saved
      }).catch(error=>{current=mutationOutcomeUnknown(error)?{...intent,status:'unknown'}:null;persist();throw error}).finally(()=>{inFlight=null})
      return inFlight
    },
  }
}

/** Keep an unresolved confirmation across reloads without storing receipt or payment details. */
export function paymentConfirmation(owner:string,bookingId:string,storage:Pick<Storage,'getItem'|'setItem'>) {
  const key='ocvviet:payment-confirm:v1:'+owner+':'+bookingId
  let pending:string|null=null,storageError=false
  try {
    const raw=storage.getItem(key)
    if(raw&&raw!=='null') {
      const value:unknown=JSON.parse(raw)
      if(typeof value!=='string'||!value.trim())throw Error('Invalid confirmation state')
      pending=value
    }
  } catch {storageError=true}
  function persist(value:string|null) {
    try {storage.setItem(key,JSON.stringify(value));pending=value;return true}
    catch {storageError=true;return false}
  }
  return {
    get pending(){return pending},get storageError(){return storageError},
    begin(paymentId:string) {return Boolean(owner&&bookingId&&paymentId&&!pending&&!storageError&&persist(paymentId))},
    clear() {return !storageError&&persist(null)},
  }
}
