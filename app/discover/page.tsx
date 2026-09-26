import {Suspense} from "react";
import {DiscoverApp} from "@/components/discover-app";
export default function DiscoverPage() { return <Suspense fallback={<div className="page-loading"><span className="loading-orbit"/>Loading signals…</div>}><DiscoverApp/></Suspense>; }
