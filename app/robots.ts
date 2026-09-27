import type {MetadataRoute} from "next";

export default function robots():MetadataRoute.Robots{
  const origin=process.env.NEXT_PUBLIC_APP_URL??"https://dibs-metropolis.vercel.app";
  return {rules:{userAgent:"*",allow:"/",disallow:["/api/"]},sitemap:`${origin}/sitemap.xml`,host:origin};
}
