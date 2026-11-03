import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Point, SceneMarker } from './ble'
export type CameraView = 'perspective' | 'top' | 'side' | 'front'
export function createModelScene(host: HTMLDivElement, onPick: (name: string)=>void, onLost: ()=>void, onPlace?: (point:Point,node:string)=>void, onMarker?: (id:string)=>void) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0xeef3f6,1); renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-label','Mô hình tàu 3D. Sử dụng các nút góc nhìn, phóng to và thu nhỏ ở thanh công cụ.'); renderer.domElement.setAttribute('role','img')
  host.append(renderer.domElement)
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(38,1,.01,100000)
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=false; controls.screenSpacePanning=true
  scene.add(new THREE.HemisphereLight(0xffffff,0x526477,2.8))
  const light=new THREE.DirectionalLight(0xffffff,3); light.position.set(80,180,110); scene.add(light)
  const fill=new THREE.DirectionalLight(0xe6f3ff,2); fill.position.set(-80,40,-100); scene.add(fill)
  let root: THREE.Group | null=null, disposed=false, highlight:THREE.BoxHelper|null=null
  const overlay=new THREE.Group();scene.add(overlay);let placing=false
  const render=()=>{if(!disposed) renderer.render(scene,camera)}
  controls.addEventListener('change',render)
  const resize=new ResizeObserver(()=>{if(disposed)return; const {width,height}=host.getBoundingClientRect(); renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();render()});resize.observe(host)
  const bounds=()=>root?new THREE.Box3().setFromObject(root):new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1))
  function frame(box:THREE.Box3,view:CameraView='perspective') {
    const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3())
    const radius=Math.max(size.x,size.y,size.z,1)
    const directions={perspective:new THREE.Vector3(1,.65,1),top:new THREE.Vector3(0,1,.0001),side:new THREE.Vector3(0,.08,1),front:new THREE.Vector3(1,.08,0)}
    const direction=directions[view].normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))
    let distance=1
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const offset=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,Math.abs(offset.dot(right))/(tangent*camera.aspect)+offset.dot(direction),Math.abs(offset.dot(up))/tangent+offset.dot(direction))}
    camera.position.copy(center).add(direction.multiplyScalar(distance*1.2));camera.near=Math.max(radius/10000,.001);camera.far=Math.max(radius*100,1000);camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=radius/1000;controls.maxDistance=radius*20;controls.update();render()
  }
  function clearHighlight(){if(highlight){scene.remove(highlight);highlight.geometry.dispose();(highlight.material as THREE.Material).dispose();highlight=null}}
  function disposeRoot(group:THREE.Object3D) { const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();group.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material)}});for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose()}for(const texture of textures){texture.dispose();if(texture.image instanceof ImageBitmap)texture.image.close()} }
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();let downX=0,downY=0
  const down=(event:PointerEvent)=>{downX=event.clientX;downY=event.clientY}
  const pick=(event:PointerEvent)=>{if(!root||Math.hypot(event.clientX-downX,event.clientY-downY)>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);if(!placing){const marker=raycaster.intersectObject(overlay,true).find(hit=>hit.object.userData.markerId);if(marker){onMarker?.(marker.object.userData.markerId as string);return}}const hit=raycaster.intersectObject(root,true)[0];if(hit){if(placing){onPlace?.({x:hit.point.x,y:hit.point.y,z:hit.point.z},hit.object.name);return}let node:THREE.Object3D|null=hit.object;while(node){onPick(node.name);node=node.parent}}}
  function clearMarkers(){while(overlay.children.length){const child=overlay.children[0];overlay.remove(child);disposeRoot(child)}}
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',pick);renderer.domElement.addEventListener('webglcontextlost',onLost)
  return {
    async load(bytes:ArrayBuffer){const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!url.startsWith('blob:')&&!url.startsWith('data:'))throw new Error('Model GLB tham chiếu tài nguyên ngoài gói. Cần gói GLB tự chứa.');return url});const gltf=await new GLTFLoader(manager).parseAsync(bytes,'');if(disposed){disposeRoot(gltf.scene);return}if(root){scene.remove(root);disposeRoot(root)}clearHighlight();root=gltf.scene;scene.add(root);frame(bounds())},
    view:(view:CameraView)=>frame(bounds(),view),
    zoom:(factor:number)=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();render()},
    select:(name:string,focus:boolean)=>{clearHighlight();const object=root?.getObjectByName(name);if(!object){render();return false}highlight=new THREE.BoxHelper(object,0xf4ac28);highlight.material.depthTest=false;highlight.material.transparent=true;highlight.renderOrder=20;scene.add(highlight);if(focus)frame(new THREE.Box3().setFromObject(object));else render();return true},
    wireframe:(value:boolean)=>{root?.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if('wireframe' in material){(material as THREE.MeshStandardMaterial).wireframe=value}});render()},
    markers:(markers:SceneMarker[])=>{clearMarkers();const scale=Math.max(bounds().getSize(new THREE.Vector3()).length()/250,.18);for(const marker of markers){const group=new THREE.Group();group.name=marker.id;group.position.set(marker.position.x,marker.position.y+.04,marker.position.z);const geometry=marker.radius?new THREE.RingGeometry(marker.radius*.97,marker.radius,72):new THREE.SphereGeometry(scale,14,10);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:marker.color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthTest:false}));if(marker.radius)mesh.rotation.x=-Math.PI/2;mesh.renderOrder=10;mesh.userData.markerId=marker.id;group.add(mesh);overlay.add(group)}render()},
    focusMarker:(id:string)=>{const target=overlay.getObjectByName(id);if(target)frame(new THREE.Box3().setFromObject(target));return Boolean(target)},
    placement:(value:boolean)=>{placing=value;renderer.domElement.style.cursor=value?'crosshair':'grab'},
    dispose:()=>{disposed=true;resize.disconnect();controls.dispose();clearHighlight();clearMarkers();if(root)disposeRoot(root);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',pick);renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()},
  }
}
export type ModelScene = ReturnType<typeof createModelScene>
