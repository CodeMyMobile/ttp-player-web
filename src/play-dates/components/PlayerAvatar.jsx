import React, { useState } from "react";

const dimensionClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const fontClasses = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-2xl",
};

const badgeClasses = {
  xs: "h-3 w-3 text-[8px]",
  sm: "h-3.5 w-3.5 text-[9px]",
  md: "h-4 w-4 text-[10px]",
  lg: "h-5 w-5 text-[11px]",
  xl: "h-6 w-6 text-[12px]",
};

const gradientClasses = {
  emerald: "from-emerald-500 via-emerald-600 to-lime-500",
  sky: "from-sky-500 via-blue-500 to-indigo-500",
  indigo: "from-indigo-500 via-violet-500 to-purple-600",
  violet: "from-violet-500 via-fuchsia-500 to-purple-700",
  amber: "from-amber-400 via-orange-500 to-rose-500",
  slate: "from-slate-500 via-slate-600 to-slate-800",
};

const computeInitials = (name) => {
  const source = (name || "").trim();
  if (!source) return "MP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const joinClasses = (...values) =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : value))
    .filter(Boolean)
    .join(" ")
    .trim();

const PlayerAvatar = ({
  name,
  imageUrl,
  fallback,
  alt,
  size = "md",
  className = "",
  variant = "emerald",
  showBadge = true,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedImageUrl =
    typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : "";
  const dimensions = dimensionClasses[size] || dimensionClasses.md;
  const fontSize = fontClasses[size] || fontClasses.md;
  const badgeSize = badgeClasses[size] || badgeClasses.md;
  const gradient = gradientClasses[variant] || gradientClasses.emerald;
  const label = alt || `${name || "Player"} avatar`;
  const initials = fallback && fallback.trim() ? fallback.trim() : computeInitials(name);

  const imageClassName = joinClasses(
    "rounded-full object-cover shadow-sm shrink-0",
    dimensions,
    className,
  );
  const wrapperClassName = joinClasses(
    "relative inline-flex items-center justify-center overflow-hidden rounded-full font-black text-white shadow-sm shrink-0",
    dimensions,
    fontSize,
    className,
  );
  const badgeClassName = joinClasses(
    "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white/60 bg-white/90 text-[10px] shadow-sm",
    badgeSize,
  );

  const shouldRenderImage = normalizedImageUrl && !imageFailed;

  if (shouldRenderImage) {
    return (
      <img
        src={normalizedImageUrl}
        alt={label}
        className={imageClassName}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={wrapperClassName} role="img" aria-label={label}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} aria-hidden="true" />
      <span className="relative drop-shadow-sm">{initials}</span>
      {showBadge && (
        <span className={badgeClassName} aria-hidden="true">
          🎾
        </span>
      )}
    </div>
  );
};

export default PlayerAvatar;
