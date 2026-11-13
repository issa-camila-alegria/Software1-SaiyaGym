import { useEffect } from "react";

// Aviso flotante. El de éxito desaparece solo a los 5 segundos; el de error
// se queda hasta que la persona lo cierre (así alcanza a leerlo y corregir).
function Mensaje({ mensaje, onCerrar }) {
  useEffect(() => {
    if (!mensaje || mensaje.tipo === "error") return undefined;

    const temporizador = setTimeout(onCerrar, 5000);
    return () => clearTimeout(temporizador);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div
      className={`mensaje ${mensaje.tipo}`}
      role={mensaje.tipo === "error" ? "alert" : "status"}
    >
      <span>{mensaje.texto}</span>
      <button
        type="button"
        className="mensaje-cerrar"
        onClick={onCerrar}
        aria-label="Cerrar mensaje"
      >
        ×
      </button>
    </div>
  );
}

export default Mensaje;
