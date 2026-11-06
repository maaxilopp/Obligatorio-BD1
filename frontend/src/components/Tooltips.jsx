import { useEffect, useState } from "react";
import "./Tooltips.css";

const SEPARACION = 10;

// Reemplaza el cartel nativo de los atributos title. Mientras el mouse está
// encima se saca el title (si no, aparecen los dos) y al salir se devuelve.
export default function Tooltips() {
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    let actual = null;
    let texto = "";

    function cerrar() {
      if (!actual) return;
      actual.setAttribute("title", texto);
      actual = null;
      setTooltip(null);
    }

    function entrar(evento) {
      if (actual?.contains(evento.target)) return;
      cerrar();

      const elemento = evento.target.closest?.("[title]");
      if (!elemento?.title) return;

      actual = elemento;
      texto = elemento.title;
      elemento.removeAttribute("title");

      const caja = elemento.getBoundingClientRect();
      const margen = Math.min(140, texto.length * 4 + 20);
      setTooltip({
        texto,
        x: Math.min(Math.max(caja.left + caja.width / 2, margen), innerWidth - margen),
        y: caja.top > 60 ? caja.top - SEPARACION : caja.bottom + SEPARACION,
        abajo: caja.top <= 60,
      });
    }

    document.addEventListener("mouseover", entrar);
    document.addEventListener("click", cerrar, true);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      cerrar();
      document.removeEventListener("mouseover", entrar);
      document.removeEventListener("click", cerrar, true);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      className={`tooltip-retro ${tooltip.abajo ? "abajo" : ""}`}
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.texto}
    </div>
  );
}
