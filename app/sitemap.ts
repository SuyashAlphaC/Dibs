import type {MetadataRoute} from "next";

export default function sitemap():MetadataRoute.Sitemap{
  const origin=process.env.NEXT_PUBLIC_APP_URL??"https://dibs-metropolis.vercel.app";
  const lastModified=new Date("2026-09-27T00:00:00.000Z");
  return [
    {url:`${origin}/discover`,lastModified,changeFrequency:"hourly",priority:1},
    {url:`${origin}/dibs`,lastModified,changeFrequency:"daily",priority:.7},
    {url:`${origin}/activity`,lastModified,changeFrequency:"daily",priority:.6},
    {url:`${origin}/profile`,lastModified,changeFrequency:"weekly",priority:.6},
    {url:`${origin}/privacy`,lastModified,changeFrequency:"yearly",priority:.2},
  ];
}
