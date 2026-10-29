import {SHIP_TIME_ZONE,validTimeZone,wallTimeToInstant} from '@/shared/lib/journey-time'

/** A shore occurrence must supply its own port zone; never use the browser zone. */
export function programInstant(value:string,shore:boolean,portZone?:string|null):string {
 const zone=shore?portZone:SHIP_TIME_ZONE
 if(!validTimeZone(zone))throw new Error('PROGRAM_TIME_ZONE_REQUIRED')
 return wallTimeToInstant(value,zone)
}
