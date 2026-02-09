import withPWA from "@ducanh2912/next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: process.env.NODE_ENV === "production",
  cacheStartUrl: false,
  disable: process.env.NODE_ENV === "development",
})({
  reactStrictMode: true,
});

export default nextConfig;
