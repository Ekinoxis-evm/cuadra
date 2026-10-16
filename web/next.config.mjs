/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  images: {
    // Las fotos originales de los portales pesan ~2,5 MB cada una y el CDN de
    // origen no ofrece miniaturas (ignora ?w= y rechaza variantes de path).
    // Sin esto, una grilla de 60 tarjetas descargaba ~150 MB. La optimización
    // de Next las sirve redimensionadas en WebP/AVIF y las cachea.
    remotePatterns: [
      { protocol: "https", hostname: "**.infocasas.com.uy" },
      { protocol: "https", hostname: "s3.amazonaws.com" },
      // Metrocuadrado sirve la galería desde su propio CDN.
      { protocol: "https", hostname: "multimedia.metrocuadrado.com" },
      // Ciencuadras usa un bucket con host propio dentro de S3.
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      // Fotos de proyectos: bucket público de Supabase.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // Los portales rotan de CDN; una fuente nueva no debe tumbar la página.
    // Next devuelve 400 en un host no permitido y el onError de la tarjeta
    // esconde el hueco.
    minimumCacheTTL: 2678400, // 31 días: las fotos de un listing no cambian
  },
};
