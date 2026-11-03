// Select natif à partir d'une liste valeur → libellé (lib/niveaux.ts).
// La valeur '' correspond au placeholder : non sélectionnable quand le champ
// est obligatoire, sinon elle permet de laisser le champ vide.
export default function SelectListe({
  options,
  value,
  onChange,
  placeholder,
  required = false,
  className,
}: {
  options: ReadonlyArray<{ valeur: string; libelle: string }>
  value: string
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
  className: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className}
    >
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  )
}
