import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    // Cell/Live-Link gameplay now connects directly from the real Operator (operator/index.html)
    // and Handler (handler/live/) apps via api.veildaemon.app/api/cell/* -- VeilLink no longer
    // hosts a gameplay UI of its own. Send old bookmarks/links here to the account dashboard.
    return [
      {
        source: "/table",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/table/:path*",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/live-link",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/live-link/:path*",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/dashboard",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
