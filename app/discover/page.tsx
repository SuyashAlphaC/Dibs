import {DiscoverApp} from "@/components/discover-app";

export default async function DiscoverPage({searchParams}:{searchParams:Promise<{mode?:string;q?:string}>}) {
  const {mode,q}=await searchParams;
  return <DiscoverApp initialMode={mode} initialQuery={q}/>;
}
