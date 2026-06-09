const OMISE_API = "https://api.omise.co";

// Supported bank codes (from Omise capability endpoint)
export const BANK_OPTIONS = [
  { code: "kbank", name: "ธนาคารกสิกรไทย (KBank)" },
  { code: "scb",   name: "ธนาคารไทยพาณิชย์ (SCB)" },
  { code: "bbl",   name: "ธนาคารกรุงเทพ (BBL)" },
  { code: "ktb",   name: "ธนาคารกรุงไทย (KTB)" },
  { code: "bay",   name: "ธนาคารกรุงศรีอยุธยา (BAY)" },
  { code: "ttb",   name: "ธนาคารทหารไทยธนชาต (TTB)" },
  { code: "gsb",   name: "ธนาคารออมสิน (GSB)" },
  { code: "baac",  name: "ธนาคารเพื่อการเกษตร (ธกส.)" },
  { code: "cimb",  name: "ธนาคารซีไอเอ็มบี (CIMB)" },
  { code: "uob",   name: "ธนาคารยูโอบี (UOB)" },
  { code: "ghb",   name: "ธนาคารอาคารสงเคราะห์ (GHB)" },
  { code: "ibank", name: "ธนาคารอิสลาม (IBANK)" },
] as const;

export type BankCode = (typeof BANK_OPTIONS)[number]["code"];

function auth(): string | null {
  const key = process.env.OMISE_SECRET_KEY;
  if (!key) return null;
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

async function omisePost(path: string, body: Record<string, unknown>) {
  const a = auth();
  if (!a) return null;
  const res = await fetch(OMISE_API + path, {
    method: "POST",
    headers: { Authorization: a, "Content-Type": "application/json", "Omise-Version": "2019-05-29" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export type PayoutResult =
  | { success: true; recipientId: string; transferId: string }
  | { success: false; error: string };

export async function createBankPayout(opts: {
  name: string;
  email: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amountTHB: number;
  metadata?: Record<string, string>;
}): Promise<PayoutResult> {
  if (!auth()) return { success: false, error: "Omise key not configured" };

  // 1. Create recipient
  const recipient = await omisePost("/recipients", {
    name: opts.name,
    email: opts.email,
    type: "individual",
    bank_account: {
      brand: opts.bankCode,
      number: opts.accountNumber,
      name: opts.accountName.toUpperCase(),
    },
    metadata: opts.metadata ?? {},
  });

  if (!recipient || recipient.object === "error") {
    return { success: false, error: String(recipient?.message ?? "สร้าง recipient ไม่สำเร็จ") };
  }

  const recipientId = recipient.id as string;

  // 2. Create transfer (amount in satang)
  const transfer = await omisePost("/transfers", {
    amount: Math.round(opts.amountTHB * 100),
    recipient: recipientId,
    metadata: opts.metadata ?? {},
  });

  if (!transfer || transfer.object === "error") {
    return { success: false, error: String(transfer?.message ?? "สร้าง transfer ไม่สำเร็จ") };
  }

  return {
    success: true,
    recipientId,
    transferId: transfer.id as string,
  };
}

export async function getTransferStatus(transferId: string): Promise<{
  status: string; sent: boolean; paid: boolean; failureCode: string | null;
} | null> {
  const a = auth();
  if (!a) return null;
  const res = await fetch(`${OMISE_API}/transfers/${transferId}`, {
    headers: { Authorization: a, "Omise-Version": "2019-05-29" },
  });
  const d = await res.json() as Record<string, unknown>;
  if (d.object === "error") return null;
  return {
    status: (d.status as string) ?? "pending",
    sent: Boolean(d.sent),
    paid: Boolean(d.paid),
    failureCode: (d.failure_code as string | null) ?? null,
  };
}
