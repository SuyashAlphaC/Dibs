import {NextResponse} from "next/server";
import {getEvidenceSnapshot} from "@/lib/evidence";

export const dynamic="force-dynamic";

export async function GET(){
  try{return NextResponse.json(await getEvidenceSnapshot(),{headers:{"cache-control":"no-store"}});}
  catch(error){console.error("Evidence snapshot failed",error);return NextResponse.json({error:"Live evidence is temporarily unavailable"},{status:503,headers:{"cache-control":"no-store"}});}
}
