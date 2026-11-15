// Una pregunta con varias respuestas en botones (formato del partido, quién saca…).
export default function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-400">{props.label}</p>
      <div className="flex gap-2">
        {props.options.map((o) => (
          <button
            key={o.value}
            onClick={() => props.onChange(o.value)}
            className={`flex-1 rounded-lg p-3 font-bold ${props.value === o.value ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
