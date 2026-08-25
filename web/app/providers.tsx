"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // passkey va en la lista para cerrar el círculo: la llave se configura
        // en Ajustes y sirve para volver a entrar sin correo ni código.
        loginMethods: ["email", "google", "passkey", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#ff7a45",
        },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
