import type { CSSProperties } from "react";

import type { RegionId } from "../generated/prisma/enums";
import {
  resolveRegionCrestAsset,
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

type CrestStyle = CSSProperties & { "--region-crest-image": string };

export function RegionCrest({ className, color, label, region, world }: RegionCrestProperties) {
  const fileName = resolveRegionCrestFileName(region, world);
  const asset = resolveRegionCrestAsset(region, world);
  const style: CrestStyle = { "--region-crest-image": `url('${asset}')` };
  return <span
    {...(label ? { "aria-label": label, role: "img" } : { "aria-hidden": true })}
    className={["region-crest", `region-crest--${color}`, className].filter(Boolean).join(" ")}
    data-crest-asset={fileName}
    data-crest-color={color}
    style={style}
  />;
}
