import {NextResponse} from "next/server";

const observation={
  marketId:2,
  castHash:"0x3e3481042393bdb0fb8549978e0ccb120e79c401000000000000000000000000",
  baselineQualifiedScore:1_200,
  observedAt:1_790_576_000,
  interactions:[
    {fid:101,kind:"like",accountAgeDays:400,neynarScoreBps:9_000},
    {fid:102,kind:"recast",accountAgeDays:220,neynarScoreBps:8_000},
    {fid:103,kind:"reply",accountAgeDays:90,neynarScoreBps:7_000},
    {fid:104,kind:"like",accountAgeDays:2,neynarScoreBps:9_500},
    {fid:105,kind:"reply",accountAgeDays:500,neynarScoreBps:4_000}
  ],
  action:"submit",
  previousQualityGrowthScore:0
} as const;

const challengedObservation={
  ...observation,
  marketId:3,
  castHash:"0xaff95fb8cc8dd1b979e2b58f523185c353e0b059000000000000000000000000",
  action:"resolve",
  previousQualityGrowthScore:8_000,
} as const;

export function GET(){
  return NextResponse.json(
    {simulation:true,description:"Deterministic normal and challenged CRE fixtures; never used for production settlement.",observations:[observation,challengedObservation]},
    {headers:{"cache-control":"public, max-age=300","x-dibs-simulation":"true"}},
  );
}
