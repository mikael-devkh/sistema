import { ActiveCall, RequiredMediaType } from "../hooks/use-service-manager";

const REQUIRED_MEDIA_ORDER: RequiredMediaType[] = [
  "serial",
  "defect_photo",
  "defect_video",
  "solution_video",
  "workbench_photo",
  "cupom_photo",
  "replacement_serial",
];

const MEDIA_BASE_NAMES: Record<RequiredMediaType, string> = {
  serial: "serial",
  defect_photo: "defeito",
  defect_video: "video-defeito",
  solution_video: "video-solução",
  workbench_photo: "bancada",
  cupom_photo: "cupom",
  replacement_serial: "serial-troca",
};

const MEDIA_LABELS: Record<RequiredMediaType, string> = {
  serial: "Foto do Serial do Ativo",
  defect_photo: "Foto do Defeito",
  defect_video: "Vídeo do Defeito",
  solution_video: "Vídeo da Solução",
  workbench_photo: "Foto da Bancada/Local",
  cupom_photo: "Foto do Cupom Fiscal",
  replacement_serial: "Foto do Serial de Troca (Opcional)",
};

const textEncoder = new TextEncoder();

const createCrc32Table = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
};

const CRC32_TABLE = createCrc32Table();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concatUint8Arrays = (arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((arr) => {
    combined.set(arr, offset);
    offset += arr.length;
  });
  return combined;
};

const dataUrlToUint8Array = (
  dataUrl: string,
): { bytes: Uint8Array; mimeType: string } => {
  const [meta, rawData] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?)(;base64)?$/);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  const base64 = rawData ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mimeType };
};

const extensionFromMime = (mime: string): string => {
  if (!mime) return "bin";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("avi")) return "avi";
  if (mime.includes("mpeg")) return "mpeg";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
};

const buildZip = (files: { name: string; data: Uint8Array }[]): Uint8Array => {
  const localFileRecords: Uint8Array[] = [];
  const centralDirectoryRecords: Uint8Array[] = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = textEncoder.encode(name);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const localRecord = concatUint8Arrays([localHeader, data]);
    localFileRecords.push(localRecord);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralDirectoryRecords.push(centralHeader);

    offset += localRecord.length;
  });

  const centralDirectory = concatUint8Arrays(centralDirectoryRecords);
  const localFiles = concatUint8Arrays(localFileRecords);

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localFiles.length, true);
  endView.setUint16(20, 0, true);

  return concatUint8Arrays([localFiles, centralDirectory, endRecord]);
};

export const generateZipMock = async (call: ActiveCall) => {
  const zipFileName = `FSA-${call.fsa}_EVIDENCIAS.zip`;
  const folderPrefix = `FSA-${call.fsa}/`;
  const files: { name: string; data: Uint8Array }[] = [];
  const summaryLines: string[] = [
    `Chamado: ${call.fsa}`,
    `Loja: ${call.codigoLoja}`,
    call.pdv ? `PDV: ${call.pdv}` : undefined,
    `Status: ${call.status}`,
    `Tempo total registrado: ${call.timeTotalServiceMinutes} minutos`,
    "",
    "Evidências:",
  ].filter((line): line is string => Boolean(line));

  REQUIRED_MEDIA_ORDER.forEach((media) => {
    const evidence = call.photos[media];
    if (evidence?.status === "uploaded" && evidence.dataUrl) {
      const { bytes, mimeType } = dataUrlToUint8Array(evidence.dataUrl);
      const effectiveMime = evidence.mimeType || mimeType;
      const fileName = evidence.fileName
        ? evidence.fileName
        : `${MEDIA_BASE_NAMES[media]}.${extensionFromMime(effectiveMime)}`;
      files.push({ name: `${folderPrefix}${fileName}`, data: bytes });
      summaryLines.push(`✔ ${MEDIA_LABELS[media]} -> ${fileName}`);
    } else {
      summaryLines.push(`✖ ${MEDIA_LABELS[media]} -> pendente`);
    }
  });

  const summaryContent = textEncoder.encode(summaryLines.join("\n"));
  files.push({ name: `${folderPrefix}Resumo.txt`, data: summaryContent });

  const zipBytes = buildZip(files);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
