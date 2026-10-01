import assert from "node:assert/strict";
import test from "node:test";
import {identityFromPrivyUser,toNeynarCastHash} from "./farcaster";

test("bytes32 cast hashes are converted back to Neynar bytes20 hashes",()=>{
  const bytes20=`0x${"a".repeat(40)}`;
  assert.equal(toNeynarCastHash(`${bytes20}${"0".repeat(24)}`),bytes20);
});

test("linked Privy Farcaster accounts become persistent scout identities",()=>{
  const user={linked_accounts:[{
    type:"farcaster",fid:2459338,owner_address:"0xowner",verified_at:1,first_verified_at:1,latest_verified_at:1,
    username:"suyash123",display_name:"Suyash",profile_picture_url:"https://example.com/avatar.png",
  }]} as Parameters<typeof identityFromPrivyUser>[1];
  assert.deepEqual(identityFromPrivyUser("0x335e000000000000000000000000000000002f6d",user),{
    address:"0x335e000000000000000000000000000000002f6d",
    fid:2459338,
    username:"suyash123",
    displayName:"Suyash",
    avatarUrl:"https://example.com/avatar.png",
  });
});
