import { Search } from "lucide-react";
import { useId } from "react";

interface SearchInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

const SearchInput = ({ value, placeholder = "Search coaches", onChange }: SearchInputProps) => {
  const inputId = useId();

  return (
    <div className="filters-bar__search">
      <label htmlFor={inputId} className="sr-only">
        Search coaches by name or specialty
      </label>
      <Search aria-hidden className="filters-bar__search-icon" size={18} />
      <input
        id={inputId}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </div>
  );
};

export default SearchInput;
