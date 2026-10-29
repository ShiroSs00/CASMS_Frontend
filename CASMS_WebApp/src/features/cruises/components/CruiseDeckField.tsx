import {businessCopy} from '@/shared/i18n/business-copy'
import {Field} from '@/shared/ui'

export type CruiseVenueOptions={ship:{id:string|null;name:string|null};decks:{id:string;name:string;number:number;shipId:string}[]}
export function CruiseDeckField({options,value=null,disabled=false}:{options:CruiseVenueOptions;value?:string|null;disabled?:boolean}){
 const decks=options.ship.id?options.decks.filter(deck=>deck.shipId===options.ship.id):[]
 return <>
  <p>{businessCopy('program.venue.ship')}: {options.ship.name??businessCopy('program.venue.unassignedShip')}</p>
  <Field htmlFor="program-deck" label={businessCopy('program.venue.deck')}><select id="program-deck" name="deckId" defaultValue={value??''} disabled={disabled||!options.ship.id}>
   <option value="">{businessCopy('program.venue.unassignedDeck')}</option>
   {value&&!decks.some(deck=>deck.id===value)&&<option value={value} disabled>{businessCopy('program.venue.invalidDeck')}</option>}
   {decks.map(deck=><option key={deck.id} value={deck.id}>{deck.name}</option>)}
  </select></Field>
 </>
}
