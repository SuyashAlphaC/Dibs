import type { SVGProps } from "react";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: "discover" | "dibs" | "activity" | "profile" | "bell" | "arrow" | "clock" | "people" | "trend" | "spark" | "external" | "close" | "check" }) {
  const paths = {
    discover: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>, dibs: <><path d="M5 4h14v13H8l-3 3V4Z"/><path d="m9 10 2 2 4-5"/></>, activity: <path d="M3 12h4l2-7 4 14 2-7h6"/>, profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>, arrow: <><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>, trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>, spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/>, external: <><path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>, close: <><path d="m6 6 12 12M18 6 6 18"/></>, check: <path d="m5 12 4 4L19 6"/>,
  } as const;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
