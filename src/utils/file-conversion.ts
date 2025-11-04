export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result);
        const binary = Array.from(bytes)
          .map((byte) => String.fromCharCode(byte))
          .join("");
        resolve(`data:${file.type};base64,${btoa(binary)}`);
      } else {
        reject(new Error("Formato de arquivo não suportado"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Falha ao ler o arquivo"));
    };

    reader.readAsDataURL(file);
  });
};
