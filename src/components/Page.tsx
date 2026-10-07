import { AppNav } from "./AppNav";
import ReadinessPrompt from "./ReadinessPrompt";
import LocationBanner from "./LocationBanner";
export function AppPage({children,name,unread=0,needsLocation=false}:{children:React.ReactNode,name?:string|null,unread?:number,needsLocation?:boolean}){return <div className="page"><AppNav name={name} unread={unread}/><main className="mobile" style={{padding:"76px 0 20px"}}>{needsLocation&&<LocationBanner/>}{children}</main><ReadinessPrompt/></div>}
