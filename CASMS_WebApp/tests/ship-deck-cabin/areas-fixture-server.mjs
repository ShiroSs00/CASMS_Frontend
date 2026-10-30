// Isolated visual QA data. This server never connects to the real backend or database.
import {createServer} from 'node:http'
import {URL} from 'node:url'
import process from 'node:process'
const permissions=['SHIP_READ','SHIP_CONFIGURATION_READ','SHIP_MODEL_READ','DECK_READ','CABIN_READ']
const ship={shipId:'areas-demo',shipCode:'UI-AREAS',shipName:'[Fixture UI] Tàu khu vực',status:'ACTIVE',totalCapacity:100,totalDecks:2,createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z'}
const decks=[{deckId:'technical',name:'Tầng kỹ thuật',deckNumber:0,serviceLevel:true,modelNodeKey:'D0'},{deckId:'panorama',name:'Panorama',deckNumber:10,serviceLevel:false,modelNodeKey:'D10'}]
const area=(id,name,kind,deckId)=>({objectId:id,modelNodeKey:id,name,kind,deckId,position:{x:4,y:2,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},dimensions:{x:12,y:3,z:8},metadataJson:'{"source":"visual-qa"}'})
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname.replace(/^\/api/,'')
 for await(const chunk of req){void chunk}
 const reply=(data,status=200,code)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({success:status<400,data,code,message:code}))}
 if(path==='/auth/login'||path==='/auth/refresh')return reply({accessToken:'areas-visual-fixture',userId:'areas-visual-qa',username:'areas-visual-qa',roles:['SHIP_MANAGER'],tokenType:'Bearer',expiresIn:3600})
 if(path==='/auth/me')return reply({userId:'areas-visual-qa',roles:['SHIP_MANAGER'],effectivePermissions:permissions})
 if(path==='/ships/areas-demo')return reply(ship)
 if(path==='/ships')return reply({content:[ship],number:0,totalPages:1,totalElements:1})
 if(path==='/ships/areas-demo/3d-configuration')return reply({shipId:ship.shipId,shipName:ship.shipName,configurationVersion:'fixture-1',model:{unit:'m'},decks:decks.map((deck,index)=>({...deck,rooms:[],bleAnchors:[],facilities:index?[area('restaurant','Nhà hàng Panorama','restaurant',deck.deckId),area('pool','Hồ bơi ngoài trời','pool',deck.deckId),area('lounge','Ocean Lounge','lounge',deck.deckId)]:[area('gym','Phòng tập thể thao','gym',deck.deckId)]}))})
 return reply(null,404,'FIXTURE_ROUTE_NOT_FOUND')
}).listen(5191,'127.0.0.1',()=>process.stdout.write('Areas isolated visual fixture :5191\n'))
