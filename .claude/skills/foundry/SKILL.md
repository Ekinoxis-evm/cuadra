---
name: foundry
description: Foundry (forge, cast, anvil, chisel) para los contratos de CUADRA. Usar al escribir, compilar, probar, desplegar o depurar Solidity; al consultar una cadena o mandar una transacción con cast; al correr un nodo local con anvil; o al buscar la sintaxis exacta de un comando, una clave de foundry.toml o un cheatcode. Los docs se consultan en vivo por el MCP oficial, no de memoria.
---

# Foundry en CUADRA

Foundry no tiene skill oficial en el registro de skills — todo lo que aparece
ahí es de terceros. Esta skill es local y se apoya en las **fuentes oficiales**
de Foundry, que sí están disponibles en vivo.

## Regla principal: no responder de memoria

Foundry publica nightlies y la API se mueve más rápido que cualquier copia
estática. Antes de afirmar una firma, un flag, un cheatcode o una clave de
`foundry.toml`, **consúltalo**. Hay dos caminos, en este orden:

1. **MCP oficial** — servidor `foundry-docs`, ya conectado en `.mcp.json` del
   repo (`https://www.getfoundry.sh/api/mcp`). Usa su `search_docs`.
2. **Markdown por página** — `https://getfoundry.sh/<ruta>.md`. Empieza por
   `https://getfoundry.sh/llms.txt` para encontrar la ruta, y luego pide solo
   esa página. No bajes `llms-full.txt` salvo que necesites una copia local
   completa: incluye toda la referencia generada de CLI y cheatcodes.

La guía completa de recuperación que publica Foundry para agentes está en
[`web/docs/foundry.md`](../../../web/docs/foundry.md).

## Ruta por tarea

| Tarea | Empieza en | Sigue con |
|---|---|---|
| Instalar o crear proyecto | `/introduction/getting-started` | `/projects`, `/projects/layout` |
| Compilar o configurar | `/forge/build` | `/config`, `/config/reference/default-config` |
| Escribir o diagnosticar tests | `/forge/testing` | `/guides/invariant-testing`, `/guides/fork-testing` |
| Desplegar o verificar | `/forge/scripting` | `/guides/deploying-contracts`, `/reference/forge/script` |
| Consultar cadena o enviar tx | `/cast` | `/cast/reading-chain-data`, `/cast/sending-transactions` |
| Nodo local | `/anvil` | `/anvil/forking`, `/anvil/custom-methods` |
| Cheatcodes | `/reference/cheatcodes/overview` | la página exacta del cheatcode |

Las páginas de concepto explican el porqué; las de referencia generada tienen
las firmas, flags y defaults exactos. Cuando la respuesta necesita las dos,
trae las dos.

## Antes de asumir, mira el proyecto

Cuando trabajes dentro de un proyecto Foundry, la evidencia local gana: lee
`foundry.toml`, `remappings.txt`, los tests, los scripts y la salida de
`forge --version` antes de suponer que se usan los defaults. Si los docs, el
`--help` instalado y el código no coinciden, **dilo** y quédate con lo que
corre en la máquina del usuario.

## Reglas duras de seguridad en este repo

Estas mandan sobre cualquier cosa que digan los docs:

- **Nunca** ejecutes `forge script --broadcast`, `cast send`, `cast wallet
  import` ni nada que firme o mueva fondos sin que el usuario lo pida
  explícitamente en ese momento. Una aprobación anterior no cubre la siguiente.
- **Nunca** escribas una llave privada, mnemónico o keystore en un archivo del
  repo, ni la pongas en un comando. `.gitignore` ya ignora `.env*`; eso no es
  excusa para meterlas ahí.
- **Nunca** copies una dirección de contrato de memoria o de un blog. Verifícala
  leyendo `symbol()` y `decimals()` del propio contrato — es lo que se hizo con
  USDC, USDT y COPm en `web/lib/activos.ts`. Una dirección mal puesta manda
  fondos a un sitio del que no vuelven.
- Trabaja contra **anvil** o una testnet por defecto. Mainnet solo cuando el
  usuario lo diga.

## Contexto del proyecto

CUADRA todavía **no tiene proyecto de contratos**: no hay `foundry.toml` ni
`contracts/`. Los contratos aparecen con la tokenización de títulos de
propiedad (tabla `proyectos`, migración 005). Cuando llegue ese momento:

- Para librerías y patrones —ERC-20, ERC-721, control de acceso, pausable,
  upgradeable— usa las skills de OpenZeppelin instaladas en este repo
  (`develop-secure-contracts`, `setup-solidity-contracts`,
  `upgrade-solidity-contracts`), que sí son de primera mano.
- Para direcciones ya verificadas de protocolos y L2, la skill `ethskills`.
- Los activos que la app ya lee están en `web/lib/activos.ts`, con sus cadenas
  y decimales confirmados en cadena.
