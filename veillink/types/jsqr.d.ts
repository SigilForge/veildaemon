declare module "jsqr" {
  export type QRCode = {
    data: string;
    location: unknown;
  };

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
  ): QRCode | null;
}
