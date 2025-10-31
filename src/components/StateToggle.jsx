const StateToggle = ({ value, onChange }) => {
  return (
    <label className="state-toggle">
      <span className="state-toggle__label">Demo state</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Preview application states"
      >
        <option value="default">Default</option>
        <option value="loading">Loading</option>
        <option value="empty">Empty</option>
        <option value="error">Error</option>
      </select>
    </label>
  );
};

export default StateToggle;
