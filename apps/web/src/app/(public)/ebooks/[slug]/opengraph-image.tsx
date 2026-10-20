import { ImageResponse } from "next/og";
import { formatINR } from "@ebook/shared";
import { getProduct } from "@/lib/server-api";
import { SITE_NAME } from "@/lib/site";

export const alt = "eBook cover, title and price";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:5000";

/**
 * Loads the book's cover as a PNG data URL. Covers are stored as WebP, which the image renderer
 * can't draw, so they are converted with sharp (installed with Next.js). The card still renders
 * without a cover if anything fails.
 */
async function coverDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const { default: sharp } = await import("sharp");
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(340, 510, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** A share card for one book: cover, title, author and price on the brand gradient. */
export default async function BookOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  const cover = await coverDataUrl(product?.coverUrl ?? null);
  const onSale = product ? product.effectivePricePaise < product.pricePaise : false;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "60px 72px",
          background: "linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG by next/og, not a page
          <img src={cover} width={340} height={510} style={{ borderRadius: 16, objectFit: "cover", boxShadow: "0 30px 60px rgba(0,0,0,0.35)" }} alt="" />
        ) : (
          <div style={{ display: "flex", width: 340, height: 510, borderRadius: 16, background: "rgba(255,255,255,0.14)", padding: 32, fontSize: 40, fontWeight: 700, alignItems: "flex-end" }}>
            {product?.title ?? SITE_NAME}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22 }}>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.8 }}>{product?.categories[0] ?? "eBook"}</div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.08 }}>{product?.title ?? SITE_NAME}</div>
          {product?.author ? <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>by {product.author}</div> : null}
          {product ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 800 }}>{formatINR(product.effectivePricePaise)}</div>
              {onSale ? <div style={{ display: "flex", fontSize: 32, opacity: 0.7, textDecoration: "line-through" }}>{formatINR(product.pricePaise)}</div> : null}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 28, marginTop: 18, opacity: 0.9 }}>{SITE_NAME} · Read a free sample · Instant access</div>
        </div>
      </div>
    ),
    size,
  );
}
