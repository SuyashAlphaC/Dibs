import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {remotePatterns: [{protocol: "https", hostname: "api.dicebear.com"}]},
  async headers(){
    const securityHeaders=[
      {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.privy.io https://*.walletconnect.com https://*.reown.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src https://*.privy.io https://*.walletconnect.com https://*.reown.com; frame-ancestors 'self' https://farcaster.xyz https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com https://base.app https://*.base.app; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains; preload"},
    ];
    return [{source:"/(.*)",headers:securityHeaders}];
  },
};

export default nextConfig;
