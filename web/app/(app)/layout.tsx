import Providers from "../providers";

/**
 * Privy solo se carga en las rutas que lo necesitan (búsqueda y cuenta).
 * Antes vivía en el layout raíz y arrastraba ~760 kB de JS a la landing, que
 * es una página estática sin sesión.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
