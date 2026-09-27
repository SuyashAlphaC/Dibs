import {DiscoverApp} from "@/components/discover-app";

export default async function DiscoverPage({searchParams}:{searchParams:Promise<{mode?:string}>}) {
  const {mode}=await searchParams;
  return <DiscoverApp initialMode={mode}/>;
}
