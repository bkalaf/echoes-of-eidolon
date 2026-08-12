import type { RegionId } from "../generated/prisma/enums";
import {
  resolveRegionCrestFileName,
  type CrestColor,
  type CrestWorld,
} from "../content/region-crests";

interface RegionCrestProperties {
  className?: string;
  color: CrestColor;
  label?: string;
  region: RegionId | string | number;
  world?: CrestWorld;
}

export function RegionCrest({ className, color, label, region, world }: RegionCrestProperties) {
  const fileName = resolveRegionCrestFileName(region, world);
  const symbolId = `crest-${fileName.replace(/\.svg$/, "")}`;
  return <svg
    {...(label ? { "aria-label": label, role: "img" } : { "aria-hidden": true })}
    className={["region-crest", `region-crest--${color}`, className].filter(Boolean).join(" ")}
    data-crest-asset={fileName}
    data-crest-color={color}
    focusable="false"
    preserveAspectRatio="xMidYMid meet"
    viewBox="0 0 512 512"
  >
    <use href={`/crests/region-crests.svg#${symbolId}`} />
  </svg>;
}
