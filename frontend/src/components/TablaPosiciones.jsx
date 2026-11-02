
import './TablaPosiciones.css';

const coloresEquipos = [
  '#ff801f',
  '#89aaff',
  '#c5a0eb',
  '#80d5a4',
  '#ff9890',
  '#ffd044'
];

function colorEquipo(idEquipo) {
  const indice = (Number(idEquipo) - 1) % coloresEquipos.length;
  return coloresEquipos[indice];
}


function TablaPosiciones({ posiciones = [], rachas = [] }) {
    const lider = posiciones[0];
  return (
    <section className="posiciones-contenedor">
      
<div className="posiciones-encabezado">
  <div>
    <p className="posiciones-edicion">EDICIÓN 2026 · 2° SEMESTRE</p>
    <h2>Tabla de posiciones</h2>
  </div>

  {lider && (
    <div className="lider-circulo">
      <span className="lider-etiqueta">LÍDER DEL TORNEO</span>
      <div
  className="lider-escudo"
  style={{ backgroundColor: colorEquipo(lider.id_equipo) }}
>
        {lider.equipo.substring(0, 2).toUpperCase()}
      </div>
      <strong>{lider.equipo}</strong>
      <span>{lider.pts} pts · {lider.dg > 0 ? '+' : ''}{lider.dg} DG</span>
    </div>
  )}
</div>


      {posiciones.length === 0 ? (
        <p>No hay posiciones disponibles para este torneo.</p>
      ) : (
        <div className="posiciones-scroll">
          <table className="tabla-posiciones">
            <thead>
              <tr>
                <th>Puesto</th>
                <th>Equipo</th>
                <th>PJ</th>
                <th>PG</th>
                <th>PE</th>
                <th>PP</th>
                <th>DG</th>
                <th>Racha</th>
                <th>Pts</th>
              </tr>
            </thead>

            <tbody>
              {posiciones.map((equipo) => (
                <tr key={equipo.id_equipo}>
                  <td>{equipo.posicion}</td>

                  
<td className="nombre-equipo">
  <div className="equipo-info">
    <div
  className="equipo-escudo"
  style={{ backgroundColor: colorEquipo(equipo.id_equipo) }}
>
      {equipo.equipo.substring(0, 2).toUpperCase()}
    </div>

    <div>
      <strong>{equipo.equipo}</strong>
      <small>{equipo.facultad}</small>
    </div>
  </div>
</td>


                  <td>{equipo.pj}</td>
                  <td>{equipo.pg}</td>
                  <td>{equipo.pe}</td>
                  <td>{equipo.pp}</td>
                  <td>{Number(equipo.dg) > 0 ? '+' : ''}{equipo.dg}</td>
                  
<td>
  <div className="racha-equipo">
    {(rachas.find(
      (r) => r.equipo === equipo.equipo
    )?.ultimos_3 || '')
      .split(' ')
      .filter(Boolean)
      .map((resultado, index) => (
        <span
          key={index}
          className={`racha-cuadro racha-${resultado}`}
        >
          {resultado}
        </span>
      ))}
  </div>
</td>

                  <td className="puntos-equipo">{equipo.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TablaPosiciones;
