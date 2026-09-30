export function logError(event:string,error:unknown,meta:Record<string,unknown>={}){const safe={event,timestamp:new Date().toISOString(),...meta,error:error instanceof Error?error.message:String(error)};console.error(JSON.stringify(safe));}
export function logInfo(event:string,meta:Record<string,unknown>={}){console.info(JSON.stringify({event,timestamp:new Date().toISOString(),...meta}));}
