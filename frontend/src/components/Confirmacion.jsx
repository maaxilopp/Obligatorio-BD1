import { useEffect, useRef } from "react";
import "./Confirmar.css";

const BORRA = /^¿(Eliminar|Sacar|Dar de baja)/;

export default function Confirmacion({ mensaje, responder }) {
  const dialogo = useRef(null);
  const peligro = BORRA.test(mensaje);

  useEffect(() => {
    dialogo.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className={`confirmar ${peligro ? "peligro" : ""}`}
      onClose={() => responder(false)}
      onClick={(evento) => {
        if (evento.target === dialogo.current) responder(false);
      }}
    >
      <div className="confirmar-encabezado">
        <span className="confirmar-carta" aria-hidden="true" />
        <h2>¿Seguro?</h2>
      </div>

      <div className="confirmar-contenido">
        <p>{mensaje}</p>
        <div className="confirmar-acciones">
          <button type="button" onClick={() => responder(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="confirmar-aceptar"
            onClick={() => responder(true)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </dialog>
  );
}
