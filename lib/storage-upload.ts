import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import { compressImageFile } from "@/lib/image-compress";

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

/** Storage rules vyžadují image/* nebo PDF — prázdný file.type na Safari občas selže. */
function contentTypeForUpload(file: File): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }
  const n = file.name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

export async function uploadUserFile(
  uid: string,
  prefix: string,
  file: File
): Promise<{ url: string; path: string; uploadedAt: number }> {
  const storage = getFirebaseStorage();
  const path = `users/${uid}/${prefix}-${Date.now()}-${safeName(file.name)}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: contentTypeForUpload(file) });
  const url = await getDownloadURL(r);
  return { url, path: r.fullPath, uploadedAt: Date.now() };
}

export async function uploadTeamFile(
  teamId: string,
  prefix: string,
  file: File
): Promise<{ url: string; path: string; uploadedAt: number }> {
  const storage = getFirebaseStorage();
  const path = `teams/${teamId}/${prefix}-${Date.now()}-${safeName(file.name)}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: contentTypeForUpload(file) });
  const url = await getDownloadURL(r);
  return { url, path: r.fullPath, uploadedAt: Date.now() };
}

/**
 * Cover obrázek oznámení: komprese → `announcements/` (mimo GDPR mazání users/teams).
 */
export async function uploadAnnouncementImage(
  file: File
): Promise<{
  url: string;
  path: string;
  originalBytes: number;
  compressedBytes: number;
}> {
  const { file: compressed, originalBytes, compressedBytes } =
    await compressImageFile(file);
  const storage = getFirebaseStorage();
  const path = `announcements/${Date.now()}-${safeName(compressed.name)}`;
  const r = ref(storage, path);
  await uploadBytes(r, compressed, {
    contentType: contentTypeForUpload(compressed),
  });
  const url = await getDownloadURL(r);
  return { url, path: r.fullPath, originalBytes, compressedBytes };
}
