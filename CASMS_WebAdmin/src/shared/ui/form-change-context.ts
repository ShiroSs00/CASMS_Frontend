import {createContext} from 'react'
export type FormState={dirty:boolean;busy:boolean}
export const Changes=createContext<((id:string,state:FormState|null)=>void)|null>(null)
export const WorkspaceChange=createContext<(change:()=>void)=>void>(change=>change())
