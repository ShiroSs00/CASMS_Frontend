import {useEffect,useState} from 'react'

/** Expire a visible assessment without silently rerunning any server action. */
export function useReadinessClock(validUntil:string|null|undefined) {
  const [now,setNow]=useState(()=>Date.now())
  useEffect(()=>{
    const update=()=>setNow(Date.now())
    const deadline=validUntil?Date.parse(validUntil):NaN
    const timer=Number.isFinite(deadline)&&deadline>now?setTimeout(update,Math.min(2147483647,Math.max(0,deadline-Date.now()+1))):undefined
    window.addEventListener('focus',update)
    document.addEventListener('visibilitychange',update)
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}
  },[validUntil,now])
  return now
}
