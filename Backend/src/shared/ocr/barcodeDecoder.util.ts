import sharp from "sharp";
import jsQR from "jsqr";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

export type BarcodeDetection = {
  type: "qr" | "pdf417" | "aztec" | "datamatrix" | "code128" | "unknown";
  data: string;
  format: string;
  bbox?: { x: number; y: number; width: number; height: number };
};

function getBarcodeType(format: BarcodeFormat): BarcodeDetection["type"] {
  switch (format) {
    case BarcodeFormat.QR_CODE:
      return "qr";
    case BarcodeFormat.PDF_417:
      return "pdf417";
    case BarcodeFormat.AZTEC:
      return "aztec";
    case BarcodeFormat.DATA_MATRIX:
      return "datamatrix";
    case BarcodeFormat.CODE_128:
      return "code128";
    default:
      return "unknown";
  }
}

export async function decodeBarcodesFromBuffer(
  buffer: Buffer,
  fileType: "pdf" | "image"
): Promise<BarcodeDetection[]> {
  try {
    const sharpInstance =
      fileType === "pdf"
        ? sharp(buffer, { density: 175 })
        : sharp(buffer);

    const { data, info } = await sharpInstance
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelData = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
    const luminanceSource = new RGBLuminanceSource(
      pixelData,
      info.width,
      info.height
    );
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = new MultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.PDF_417,
      BarcodeFormat.AZTEC,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.CODE_128,
    ]);
    reader.setHints(hints);

    const result = reader.decode(bitmap);
    if (!result?.getText()) return [];

    const format = result.getBarcodeFormat();
    const location = result.getResultPoints?.() ?? [];
    const bbox = location.length
      ? {
          x: Math.min(...location.map((p) => p.getX())),
          y: Math.min(...location.map((p) => p.getY())),
          width:
            Math.max(...location.map((p) => p.getX())) -
            Math.min(...location.map((p) => p.getX())),
          height:
            Math.max(...location.map((p) => p.getY())) -
            Math.min(...location.map((p) => p.getY())),
        }
      : undefined;

    return [
      {
        type: getBarcodeType(format),
        format: format.toString(),
        data: result.getText(),
        bbox,
      },
    ];
  } catch (err) {
    try {
      const qrResult = await decodeQrFromBuffer(buffer, fileType);
      return qrResult;
    } catch {
      return [];
    }
  }
}

async function decodeQrFromBuffer(
  buffer: Buffer,
  fileType: "pdf" | "image"
): Promise<BarcodeDetection[]> {
  const sharpInstance =
    fileType === "pdf" ? sharp(buffer, { density: 175 }) : sharp(buffer);

  const { data, info } = await sharpInstance
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const clamped = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );

  const result = jsQR(clamped, info.width, info.height);
  if (!result) return [];

  const bbox = {
    x: result.location.topLeftCorner.x,
    y: result.location.topLeftCorner.y,
    width: Math.abs(
      result.location.topRightCorner.x - result.location.topLeftCorner.x
    ),
    height: Math.abs(
      result.location.bottomLeftCorner.y - result.location.topLeftCorner.y
    ),
  };

  return [
    {
      type: "qr",
      format: BarcodeFormat.QR_CODE.toString(),
      data: result.data,
      bbox,
    },
  ];
}

export default decodeBarcodesFromBuffer;
