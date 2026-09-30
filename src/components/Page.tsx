import { AppNav } from "./AppNav";
import ReadinessPrompt from "./ReadinessPrompt";
export function AppPage({children,name,unread=0}:{children:React.ReactNode,name?:string|null,unread?:number}){return <div className="page"><AppNav name={name} unread={unread}/><main className="mobile" style={{padding:"76px 0 20px"}}>{children}</main><ReadinessPrompt/></div>}
