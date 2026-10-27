import yauzl from "yauzl";
import iconv from "iconv-lite";
import { parse } from "csv-parse";
import { Readable, Transform } from "node:stream";
import { createReadStream } from "node:fs";

/** Normaliza o nome de uma coluna: sem acentos, sem "(R$)", minúsculo, só letras e dígitos. */
export function normalizarColuna(s: string): string {
  return s
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type Linha = Record<string, string>;

/**
 * Converte os bytes de um CSV do Portal em texto. Os arquivos são publicados em
 * ISO-8859-1 (latin1); se houver BOM UTF-8, respeita o UTF-8.
 */
function decodificador(): Transform {
  let dec: ReturnType<typeof iconv.getDecoder> | null = null;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      if (!dec) {
        const utf8 = chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf;
        dec = iconv.getDecoder(utf8 ? "utf8" : "latin1");
      }
      cb(null, dec.write(chunk));
    },
    flush(cb) {
      const resto = dec?.end();
      cb(null, resto || undefined);
    },
  });
}

/**
 * Lê um fluxo CSV (separador ";", aspas duplas) e chama `aoLer` para cada linha,
 * com as chaves já normalizadas por `normalizarColuna`.
 */
export async function lerCSV(
  entrada: Readable,
  aoCabecalho: (colunas: string[]) => void,
  aoLer: (l: Linha) => void,
): Promise<void> {
  const parser = entrada.pipe(decodificador()).pipe(
    parse({
      delimiter: ";",
      columns: (cab: string[]) => {
        const norm = cab.map(normalizarColuna);
        aoCabecalho(norm);
        return norm;
      },
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }),
  );
  for await (const reg of parser) aoLer(reg as Linha);
}

/** Lista e abre, em sequência, os arquivos .csv de um .zip em disco. */
export async function paraCadaCSVNoZip(
  caminhoZip: string,
  fn: (nomeEntrada: string, fluxo: Readable) => Promise<void>,
): Promise<void> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.open(caminhoZip, { lazyEntries: true, autoClose: true }, (e, z) => (e ? rej(e) : res(z!))),
  );
  await new Promise<void>((res, rej) => {
    zip.on("error", rej);
    zip.on("end", () => res());
    zip.on("entry", (entry: yauzl.Entry) => {
      if (!/\.csv$/i.test(entry.fileName)) return zip.readEntry();
      zip.openReadStream(entry, async (e, fluxo) => {
        if (e || !fluxo) return rej(e);
        try {
          await fn(entry.fileName, fluxo);
          zip.readEntry();
        } catch (err) {
          rej(err);
        }
      });
    });
    zip.readEntry();
  });
}

/** Aceita .zip ou .csv soltos (útil para arquivos baixados manualmente). */
export async function paraCadaCSV(
  caminho: string,
  fn: (nomeEntrada: string, fluxo: Readable) => Promise<void>,
): Promise<void> {
  if (/\.csv$/i.test(caminho)) return fn(caminho, createReadStream(caminho));
  return paraCadaCSVNoZip(caminho, fn);
}

/** Extrai o mês (1–12) de valores como "2024/03", "03/2024", "202403", "2024-03". */
export function extrairMes(v: string | undefined): number | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})\D?(\d{1,2})$/);
  if (m) return valida(Number(m[2]));
  m = s.match(/^(\d{1,2})\D(\d{4})$/);
  if (m) return valida(Number(m[1]));
  m = s.match(/^\d{1,2}\/(\d{1,2})\/\d{4}$/);
  if (m) return valida(Number(m[1]));
  return null;
  function valida(n: number) {
    return n >= 1 && n <= 12 ? n : null;
  }
}

export function extrairAno(v: string | undefined): number | null {
  const m = v?.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}
