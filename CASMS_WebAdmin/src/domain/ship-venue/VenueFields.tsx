import {businessCopy} from '@/shared/i18n/business-copy'
import {Field} from '@/shared/ui'
import type {ShipVenueCabin} from './api'

export type ShipVenueOptions={ship:{id:string|null;name:string|null};decks:{id:string;name:string;number:number;shipId:string}[]}
export function ShipVenueDeckField({options,value=null,disabled=false,onChange,id='program-deck',error}:{options:ShipVenueOptions;value?:string|null;disabled?:boolean;onChange?:(id:string|null)=>void;id?:string;error?:string}){
 const decks=options.ship.id?options.decks.filter(deck=>deck.shipId===options.ship.id):[]
 return <>
  <p>{businessCopy('program.venue.ship')}: {options.ship.name??businessCopy('program.venue.unassignedShip')}</p>
  <Field htmlFor={id} label={businessCopy('program.venue.deck')} error={error}><select id={id} name="deckId" aria-invalid={Boolean(error)} aria-describedby={error?id+'-hint':undefined} {...(onChange?{value:value??'',onChange:(e:import('react').ChangeEvent<HTMLSelectElement>)=>onChange(e.target.value||null)}:{defaultValue:value??''})} disabled={disabled||!options.ship.id}>
   <option value="">{businessCopy('program.venue.unassignedDeck')}</option>
   {value&&!decks.some(deck=>deck.id===value)&&<option value={value} disabled>{businessCopy('program.venue.invalidDeck')}</option>}
   {decks.map(deck=><option key={deck.id} value={deck.id}>{deck.name}</option>)}
  </select></Field>
 </>
}

export function ShipVenueCabinField({cabins,value,onChange,disabled=false,id='program-cabin',savedName,error}:{cabins:ShipVenueCabin[];value:string|null;onChange:(id:string|null)=>void;disabled?:boolean;id?:string;savedName?:string|null;error?:string}){
 return <Field htmlFor={id} label="Cabin/phòng diễn ra hoạt động" error={error}><select id={id} name="cabinId" aria-invalid={Boolean(error)} aria-describedby={error?id+'-hint':undefined} value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value||null)}>
  <option value="">Không chọn cabin/phòng cụ thể</option>
  {value&&!cabins.some(c=>c.id===value)&&<option value={value} disabled>{savedName?`Cabin/phòng ${savedName} — cần đối chiếu`:'Cabin/phòng đã lưu — cần đối chiếu'}</option>}
  {cabins.map(c=><option key={c.id} value={c.id}>Cabin/phòng {c.number}</option>)}
 </select></Field>
}
