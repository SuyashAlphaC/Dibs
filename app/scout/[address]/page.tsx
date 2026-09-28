import {notFound} from "next/navigation";
import {ScoutProfile} from "@/components/scout-profile";

export default async function PublicScoutPage({params}:{params:Promise<{address:string}>}){
  const {address}=await params;
  if(!/^0x[a-fA-F0-9]{40}$/.test(address))notFound();
  return <ScoutProfile address={address.toLowerCase()}/>;
}
