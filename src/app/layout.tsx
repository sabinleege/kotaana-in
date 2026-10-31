import "./globals.css";
import Splash from "@/components/Splash";
import { LangProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
export const metadata={title:"Kotaana — Train. Track. Achieve.",description:"Personalized training, nutrition, health, progress and coaching."};
export default async function RootLayout({children}:{children:React.ReactNode}){const lang=await getLang();return <html lang={lang} data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const t=localStorage.getItem("kotaana-theme");const m=t==="dark"?"dark":"light";document.documentElement.dataset.theme=m;document.documentElement.style.colorScheme=m}catch(e){}})()`}} /></head><body><script dangerouslySetInnerHTML={{__html:`try{if(sessionStorage.getItem("kt-splash"))document.documentElement.classList.add("no-splash")}catch(e){}`}} /><Splash /><LangProvider lang={lang}>{children}</LangProvider></body></html>}
