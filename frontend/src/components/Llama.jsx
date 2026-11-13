// Llama de la racha. Se dibuja como SVG para que tome el color del texto
// (currentColor) y se vea nítida en cualquier tamaño. "apagada" la deja solo
// con contorno, para la racha interrumpida o inexistente.
function Llama({ apagada = false, className = "" }) {
  return (
    <svg
      className={`llama ${apagada ? "apagada" : ""} ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12.9 2.2c.4 3-1.2 4.6-2.7 6.3C8.6 10.3 7 12 7 14.6A5 5 0 0 0 12 20a5 5 0 0 0 5-5.1c0-1.6-.7-2.9-1.5-3.9-.2 1.1-.8 1.9-1.6 2.3.5-3.8-.2-7.7-1-11.1Z"
        fill={apagada ? "none" : "currentColor"}
        stroke="currentColor"
        strokeWidth={apagada ? 1.6 : 0}
        strokeLinejoin="round"
      />
      {!apagada && (
        <path
          d="M12 20a2.6 2.6 0 0 1-2.6-2.6c0-1.4 1-2.2 1.7-3.1.3.9.9 1.3 1.5 1.5.7-.5 1-1.2 1-2 .9.8 1.5 1.8 1.5 3A2.6 2.6 0 0 1 12 20Z"
          fill="#fff6d8"
          opacity="0.85"
        />
      )}
    </svg>
  );
}

export default Llama;
