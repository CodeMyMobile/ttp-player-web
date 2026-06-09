const normalizeLessonType = (value) => String(value ?? "").trim().toLowerCase();

const packageAllowsType = (pkg, lessonType) => {
  const types = Array.isArray(pkg?.lesson_types_allowed) ? pkg.lesson_types_allowed : [];
  if (lessonType === "all") return true;
  if (!types.length) return lessonType === "private";
  return types.some((type) => normalizeLessonType(type).includes(lessonType));
};

export const filterCoachPackagesByLessonType = (packages, lessonType) => {
  if (!Array.isArray(packages)) return [];
  return packages.filter((pkg) => packageAllowsType(pkg, lessonType));
};

export const getCoachPackageLessonTypeOptions = ({
  packages,
  hasGroupSlots,
  privatePriceLabel,
  groupPriceLabel,
}) => {
  const safePackages = Array.isArray(packages) ? packages : [];
  const hasPrivatePackages = safePackages.some((pkg) => packageAllowsType(pkg, "private"));
  const hasGroupPackages = safePackages.some((pkg) => packageAllowsType(pkg, "group"));
  const options = [];

  if (safePackages.length) {
    options.push({ id: "all", label: "All packages" });
  }

  if (hasPrivatePackages || privatePriceLabel) {
    options.push({
      id: "private",
      label: `Private · ${privatePriceLabel}/hr`,
    });
  }

  if (hasGroupPackages || hasGroupSlots || groupPriceLabel) {
    options.push({
      id: "group",
      label: groupPriceLabel ? `Group · ${groupPriceLabel}/hr` : "Group",
    });
  }

  return options;
};
