import { btnTransmit } from "../lib/ui";
import { TvaJumble } from "./TvaJumble";
import { TvaTerm } from "./TvaTerm";

export function TransmitButton({
  active,
  disabled,
  idleClass,
  onClick,
  title,
  label,
  flavor,
  noun,
  busyNoun,
  onPrimary,
}: {
  active: boolean;
  disabled: boolean;
  idleClass: string;
  onClick: () => void;
  title: string;
  label: string;
  flavor: string;
  noun: string;
  busyNoun: string;
  onPrimary?: boolean;
}) {
  return (
    <button
      type="button"
      className={active ? btnTransmit : idleClass}
      disabled={disabled || active}
      onClick={onClick}
      title={active ? label : title}
      aria-busy={active}
    >
      {active ? (
        <TvaJumble label={label} noun={busyNoun} />
      ) : (
        <TvaTerm flavor={flavor} noun={noun} onPrimary={onPrimary} />
      )}
    </button>
  );
}
