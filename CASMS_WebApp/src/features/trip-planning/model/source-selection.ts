import type { Entry, Source } from './plan'

/** Copies source data into this entry only. No operation updates the source entity. */
export function selectEntrySource(entry:Entry,source:Source,previous?:Source):Entry {
  const replaceTitle=!entry.title.trim()||entry.title===previous?.name
  const previousLocation=previous?.location??previous?.displayLocation??''
  const replaceLocation=!entry.locationText?.trim()||entry.locationText===previousLocation
  return {...entry,sourceId:source.id,
    sourceActivityId:entry.kind==='ONBOARD_ACTIVITY'?source.id:null,
    sourceExcursionId:entry.kind==='SHORE_EXCURSION'?source.id:null,
    serviceId:entry.kind==='SERVING_WINDOW'?source.id:null,
    title:replaceTitle?source.name??source.label:entry.title,
    ...(entry.kind==='ONBOARD_ACTIVITY'?{
      referenceShipId:source.referenceShipId??null,referenceShipName:source.referenceShipName??null,
      category:source.category??null,categoryName:source.categoryName??null,categoryIcon:source.categoryIcon??null,
      deckId:source.deckId??null,deckNumber:source.deckNumber??null,deckName:source.deckName??null,
      cabinId:source.cabinId??null,cabinNumber:source.cabinNumber??null,roomName:source.roomName??null,
      locationType:source.locationType??null,displayLocation:source.displayLocation??null,
      locationText:replaceLocation?source.location??source.displayLocation??'':entry.locationText,
    }:{}),
    ...(entry.kind==='SHORE_EXCURSION'?{
      destinationId:source.destinationId??null,
      meetingPoint:!entry.meetingPoint?.trim()||entry.meetingPoint===previous?.meetingPoint?source.meetingPoint??'':entry.meetingPoint,
    }:{}),
  }
}
