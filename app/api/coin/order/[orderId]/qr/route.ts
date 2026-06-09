import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const omise = process.env.OMISE_SECRET_KEY
  ? require("omise")({ secretKey: process.env.OMISE_SECRET_KEY, omiseVersion: "2019-05-29" })
  : null;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return new NextResponse("Unauthorized", { status: 401 });

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;

  const order = await prisma.coinOrder.findUnique({
    where: { id: orderId },
    select: { userId: true, omiseChargeId: true },
  });

  if (!order || order.userId !== userId || !order.omiseChargeId || !omise)
    return new NextResponse("Not found", { status: 404 });

  try {
    const charge = await omise.charges.retrieve(order.omiseChargeId);
    const downloadUri: string | undefined =
      charge.source?.scannable_code?.image?.download_uri;

    if (!downloadUri)
      return new NextResponse("QR not available", { status: 404 });

    // Fetch the image from Omise using secret key auth
    const basic = Buffer.from(`${process.env.OMISE_SECRET_KEY}:`).toString("base64");
    const imgRes = await fetch(downloadUri, {
      headers: { Authorization: `Basic ${basic}` },
    });

    if (!imgRes.ok)
      return new NextResponse("Failed to fetch QR", { status: 502 });

    const imageBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") ?? "image/png";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as Record<string, unknown>).message)
        : "Error";
    return new NextResponse(msg, { status: 502 });
  }
}
