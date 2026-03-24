import PropTypes from "prop-types";

import "./SliderWithBubble.css";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const SliderWithBubble = ({
  value,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  onValueChange,
  onSlidingComplete,
}) => {
  const safeValue = clamp(value, minimumValue, maximumValue);
  const percent =
    maximumValue === minimumValue
      ? 0
      : ((safeValue - minimumValue) / (maximumValue - minimumValue)) * 100;

  return (
    <div className="slider-bubble">
      <div className="slider-bubble__pin-row">
        <div className="slider-bubble__pin" style={{ left: `${percent}%` }}>
          {safeValue} miles
        </div>
      </div>

      <div className="slider-bubble__track-wrap">
        <input
          className="slider-bubble__input"
          style={{ "--progress": `${percent}%` }}
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={safeValue}
          onChange={(event) => onValueChange?.(Number(event.target.value))}
          onMouseUp={(event) => onSlidingComplete?.(Number(event.currentTarget.value))}
          onTouchEnd={(event) => onSlidingComplete?.(Number(event.currentTarget.value))}
        />
      </div>

      <div className="slider-bubble__labels">
        <span>{minimumValue} miles</span>
        <span>{maximumValue} miles</span>
      </div>
    </div>
  );
};

SliderWithBubble.propTypes = {
  value: PropTypes.number.isRequired,
  minimumValue: PropTypes.number,
  maximumValue: PropTypes.number,
  step: PropTypes.number,
  onValueChange: PropTypes.func,
  onSlidingComplete: PropTypes.func,
};

export default SliderWithBubble;
