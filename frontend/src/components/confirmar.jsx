import { createRoot } from "react-dom/client";
import Confirmacion from "./Confirmacion";

// Reemplaza a window.confirm: devuelve una promesa
export function confirmar(mensaje) {
  return new Promise((resolver) => {
    const contenedor = document.createElement("div");
    document.body.append(contenedor);
    const raiz = createRoot(contenedor);

    function responder(valor) {
      raiz.unmount();
      contenedor.remove();
      resolver(valor);
    }

    raiz.render(<Confirmacion mensaje={mensaje} responder={responder} />);
  });
}
