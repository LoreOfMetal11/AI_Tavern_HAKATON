import { listImages, saveBuffer } from "@/lib/server/media";
import { DATA_DIR, IMAGES_DIR } from "@/lib/server/media";

export const dynamic = "force-dynamic";

/** Список картинок из папки data/images (и сгенерированных). Пользователь может просто положить файлы в эту папку. */
export async function GET() {
  return Response.json({ dir: IMAGES_DIR, root: DATA_DIR, files: await listImages() });
}

/** Загрузка картинки с компьютера в папку data/images. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Нет файла" }, { status: 400 });
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".png").toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return Response.json({ error: "Только png/jpg/webp/gif" }, { status: 400 });
  const url = await saveBuffer(Buffer.from(await file.arrayBuffer()), ext, "images");
  return Response.json({ url });
}
