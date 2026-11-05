import { useEffect, useRef } from "react";
import "./Confirmar.css";

export default function Confirmacion({ mensaje, responder }) {
  const dialogo = useRef(null);

  useEffect(() => {
    dialogo.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="confirmar"
      onClose={() => responder(false)}
      onClick={(evento) => {
        if (evento.target === dialogo.current) responder(false);
      }}
    >
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
            Aceptar
          </button>
        </div>
      </div>
    </dialog>
  );
}
