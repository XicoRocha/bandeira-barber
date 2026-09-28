import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Permite abrir o servidor de desenvolvimento no telemóvel (mesma rede Wi-Fi)
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
