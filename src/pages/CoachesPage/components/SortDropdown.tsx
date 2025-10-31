import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { SortOption } from "../types";

interface SortDropdownOption {
  value: SortOption;
  label: string;
}

interface SortDropdownProps {
  value: SortOption;
  options: SortDropdownOption[];
  onChange: (value: SortOption) => void;
}

const SortDropdown = ({ value, options, onChange }: SortDropdownProps) => {
  const selectId = useId();

  return (
    <div className="filters-bar__sort">
      <label htmlFor={selectId}>Sort by</label>
      <div className="filters-bar__select-wrapper">
        <select id={selectId} value={value} onChange={(event) => onChange(event.target.value as SortOption)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} />
      </div>
    </div>
  );
};

export default SortDropdown;
