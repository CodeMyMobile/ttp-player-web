interface FilterChip {
  key: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}

const FilterChips = ({ chips, onRemove, onClearAll }: FilterChipsProps) => {
  if (!chips.length) return null;

  return (
    <div className="filters-chips" role="list" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="filters-chips__chip"
          onClick={() => onRemove(chip.key)}
          role="listitem"
        >
          {chip.label}
          <span aria-hidden className="filters-chips__chip-close">×</span>
          <span className="sr-only">Remove filter {chip.label}</span>
        </button>
      ))}
      {onClearAll ? (
        <button type="button" className="filters-chips__clear" onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  );
};

export default FilterChips;
