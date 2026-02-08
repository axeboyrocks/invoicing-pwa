import withPWA from "@ducanh2912/next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  cacheStartUrl: false,
})({
  reactStrictMode: true,
});

export default nextConfig;
