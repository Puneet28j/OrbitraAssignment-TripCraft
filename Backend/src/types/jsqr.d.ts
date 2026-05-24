declare module "jsqr" {
  type Point = { x: number; y: number };
  type Location = {
    topLeftCorner: Point;
    topRightCorner: Point;
    bottomLeftCorner: Point;
    bottomRightCorner: Point;
  };
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { data: string; location: Location } | null;
}
