/** Convert the bytes32 value emitted by Dibs back to Neynar's canonical bytes20 cast hash. */
export function toNeynarCastHash(hash:string){
  if(/^0x[0-9a-fA-F]{64}$/.test(hash)&&hash.endsWith("0".repeat(24)))return hash.slice(0,42);
  return hash;
}
