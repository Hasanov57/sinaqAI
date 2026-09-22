const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_SOLUTION_IMAGE_BYTES = 8 * 1024 * 1024;

export type SolutionImageFile = Pick<File, "name" | "size" | "type">;

export function validateSolutionImage(file: SolutionImageFile): string | null {
  if (!MIME_TO_EXTENSION[file.type]) {
    return "Yalnız JPEG, PNG və ya WEBP şəkilləri qəbul olunur.";
  }
  if (file.size <= 0) return "Seçilmiş şəkil boşdur.";
  if (file.size > MAX_SOLUTION_IMAGE_BYTES) return "Şəklin ölçüsü 8 MB-dan kiçik olmalıdır.";

  const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");
  const validExtension = file.type === "image/jpeg"
    ? extension === "jpg" || extension === "jpeg"
    : extension === MIME_TO_EXTENSION[file.type];
  return validExtension ? null : "Faylın uzantısı və şəkil formatı uyğun gəlmir.";
}

export function createSolutionImagePath(
  userId: string,
  examId: string,
  questionId: string,
  file: SolutionImageFile,
  uniqueId: string,
): string {
  const extension = MIME_TO_EXTENSION[file.type];
  if (!extension) throw new Error("Unsupported solution image type");
  const safeSegment = (value: string) => encodeURIComponent(value).replace(/%2F/gi, "_");
  return `${userId}/${safeSegment(examId)}/${safeSegment(questionId)}/${uniqueId}.${extension}`;
}
