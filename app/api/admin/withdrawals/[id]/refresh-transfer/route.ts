import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransferStatus } from "@/lib/omise-payout";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id } });
  if (!withdrawal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!withdrawal.omiseTransferId) {
    return NextResponse.json({ error: "No Omise transfer ID" }, { status: 400 });
  }

  const status = await getTransferStatus(withdrawal.omiseTransferId);
  if (!status) return NextResponse.json({ error: "Could not fetch from Omise" }, { status: 502 });

  // Auto-update if Omise says it's paid
  if (status.paid && withdrawal.status === "PROCESSING") {
    await prisma.withdrawalRequest.update({
      where: { id },
      data: { status: "PAID", processedAt: new Date() },
    });
  }

  return NextResponse.json(status);
}
