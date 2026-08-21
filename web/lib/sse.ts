/**
 * Lector de Server-Sent Events sobre una respuesta de fetch.
 *
 * No se puede usar EventSource porque solo hace GET y el chat manda POST con
 * imágenes. Esto parsea el formato a mano: los eventos se separan por línea en
 * blanco y cada uno trae `event:` y `data:`.
 */
export async function* leerSSE(
  res: Response,
): AsyncGenerator<{ evento: string; dato: unknown }> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Un fragmento de red puede cortar a mitad de evento: solo procesamos los
    // bloques completos y dejamos el resto en el buffer para la próxima vuelta.
    let corte: number;
    while ((corte = buffer.indexOf("\n\n")) !== -1) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);

      let evento = "message";
      const datos: string[] = [];
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith("event:")) evento = linea.slice(6).trim();
        else if (linea.startsWith("data:")) datos.push(linea.slice(5).trim());
      }
      if (!datos.length) continue;

      try {
        yield { evento, dato: JSON.parse(datos.join("\n")) };
      } catch {
        // Un evento malformado no debe tumbar el stream completo.
      }
    }
  }
}
