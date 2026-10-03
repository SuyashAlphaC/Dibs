import "server-only";
import {PrivyClient,type User} from "@privy-io/node";

export type AuthenticatedScout={userId:string;fid:number;username?:string};

function bearer(request:Request){
  const value=request.headers.get("authorization");
  return value?.startsWith("Bearer ")?value.slice(7).trim():null;
}

function farcasterAccount(user:User){
  return user.linked_accounts.find(account=>account.type==="farcaster");
}

/** Verify the Privy session at the mutation boundary and require a linked Farcaster identity. */
export async function authenticateScout(request:Request):Promise<AuthenticatedScout>{
  const token=bearer(request);
  const appId=process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret=process.env.PRIVY_APP_SECRET;
  if(!token)throw new Error("Connect with Privy before nominating a cast");
  if(!appId||!appSecret)throw new Error("Privy server authentication is not configured");
  const privy=new PrivyClient({appId,appSecret});
  const session=await privy.utils().auth().verifyAccessToken(token);
  const user=await privy.users()._get(session.user_id);
  const farcaster=farcasterAccount(user);
  if(!farcaster?.fid)throw new Error("Link a Farcaster profile before nominating a cast");
  return {userId:session.user_id,fid:farcaster.fid,username:farcaster.username||undefined};
}
