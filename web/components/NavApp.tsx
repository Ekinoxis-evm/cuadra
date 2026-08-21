"use client";
import Nav from "./Nav";
import AuthButton from "./AuthButton";

/** Nav para las rutas con sesión: añade el botón de Privy. */
export default function NavApp({ tabActiva }: { tabActiva?: string }) {
  return <Nav tabActiva={tabActiva} acciones={<AuthButton />} />;
}
