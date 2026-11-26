import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // /site/{id}.md is a site's design note as Markdown (the app route is /site/{id}/md).
    return [{ source: "/site/:id([0-9a-f-]{36}).md", destination: "/site/:id/md" }];
  },
};

export default nextConfig;
