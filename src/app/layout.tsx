import "./globals.css";
import Splash from "@/components/Splash";
export const metadata={title:"Kotaana — Train. Track. Achieve.",description:"Personalized training, nutrition, health, progress and coaching."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const t=localStorage.getItem("kotaana-theme");const m=t==="dark"?"dark":"light";document.documentElement.dataset.theme=m;document.documentElement.style.colorScheme=m}catch(e){}})()`}} /></head><body><script dangerouslySetInnerHTML={{__html:`try{if(sessionStorage.getItem("kt-splash"))document.documentElement.classList.add("no-splash")}catch(e){}`}} /><Splash />{children}</body></html>}
