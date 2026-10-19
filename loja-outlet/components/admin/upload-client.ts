export const MAX_MB = 4;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Validação rápida no navegador (a validação de verdade é refeita no servidor). */
export function checkFile(file: File): string | null {
  if (!OK_TYPES.includes(file.type)) return `"${file.name}": formato não aceito. Use JPG, PNG ou WebP.`;
  if (file.size > MAX_MB * 1024 * 1024) return `"${file.name}": tem mais de ${MAX_MB} MB. Reduza o tamanho e tente de novo.`;
  if (file.size === 0) return `"${file.name}": o arquivo está vazio.`;
  return null;
}

export type UploadResult = { ok: true; id?: string; url: string; path: string } | { ok: false; error: string };

/** Envia um arquivo para /api/admin/upload com progresso (0-100). */
export function uploadFile(file: File, fields: Record<string, string>, onProgress?: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => resolve({ ok: false, error: "Falha de conexão durante o envio. Verifique a internet e tente de novo." });
    xhr.ontimeout = () => resolve({ ok: false, error: "O envio demorou demais. Tente de novo com uma imagem menor." });
    xhr.timeout = 120_000;
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve(data.ok ? data : { ok: false, error: data.error ?? "Não foi possível enviar a imagem." });
      } catch {
        resolve({ ok: false, error: xhr.status === 413 ? "Imagem grande demais para o servidor. Use um arquivo menor." : "Resposta inesperada do servidor ao enviar a imagem." });
      }
    };
    xhr.send(fd);
  });
}
