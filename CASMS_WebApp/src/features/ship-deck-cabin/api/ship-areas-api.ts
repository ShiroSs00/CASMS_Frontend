import {apiRequest} from '@/shared/api'
import {decodeShipAreas} from '../model/ship-areas'

export async function readShipAreas(shipId:string,signal?:AbortSignal){
 const value=await apiRequest<unknown>(`/ships/${encodeURIComponent(shipId)}/3d-configuration`,{signal})
 return decodeShipAreas(value,shipId)
}
