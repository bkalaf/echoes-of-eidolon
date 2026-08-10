export interface ProjectedGlobePoint {
  visible: boolean;
  xPercent: number;
  yPercent: number;
}

export interface GlobeCartesianPoint {
  x: number;
  y: number;
  z: number;
}

const radians = Math.PI / 180;

export function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

export function globeCartesian(latitudeDegrees: number, longitudeDegrees: number): GlobeCartesianPoint {
  const latitude = latitudeDegrees * radians;
  const longitude = longitudeDegrees * radians;
  const latitudeRadius = Math.cos(latitude);

  return {
    x: latitudeRadius * Math.cos(longitude),
    y: Math.sin(latitude),
    z: latitudeRadius * Math.sin(longitude),
  };
}

export function projectGlobePoint(input: {
  centerLatitude: number;
  centerLongitude: number;
  latitude: number;
  longitude: number;
  zoom: number;
}): ProjectedGlobePoint {
  const latitude = input.latitude * radians;
  const centerLatitude = input.centerLatitude * radians;
  const longitudeDelta = wrapLongitude(input.longitude - input.centerLongitude) * radians;
  const east = Math.cos(latitude) * Math.sin(longitudeDelta);
  const north = Math.cos(centerLatitude) * Math.sin(latitude)
    - Math.sin(centerLatitude) * Math.cos(latitude) * Math.cos(longitudeDelta);
  const facing = Math.sin(centerLatitude) * Math.sin(latitude)
    + Math.cos(centerLatitude) * Math.cos(latitude) * Math.cos(longitudeDelta);
  return {
    visible: facing >= 0,
    xPercent: 50 + east * 46 * input.zoom,
    yPercent: 50 - north * 46 * input.zoom,
  };
}
