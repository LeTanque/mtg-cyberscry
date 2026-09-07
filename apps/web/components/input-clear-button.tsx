"use client";

import { X } from "lucide-react";

export function InputClearButton({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button type="button" className="input-clear" aria-label={label} onClick={onClear}>
      <X size={14} />
    </button>
  );
}
