import {SHIP_TIME_ZONE,wallTimeToInstant,zonedInput} from '@/shared/lib/journey-time'
export const preparationWallTime=(instant:string|null)=>instant?zonedInput(instant,SHIP_TIME_ZONE):''
export const preparationInstant=(wall:string)=>wall?wallTimeToInstant(wall,SHIP_TIME_ZONE):null
