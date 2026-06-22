/**
 * Money-logic test for the ServiceOrder system — exercises the REAL code
 * (createServiceOrder / paymentDue / applyVerifiedPayment / publicOrderView +
 * the deliver flip) against the live DB, simulating "a slip was verified" by
 * calling applyVerifiedPayment directly. It does NOT call EasySlip (that
 * external step needs a real bank slip and is the same proven code as the coin
 * flow). Creates throwaway orders and DELETES them at the end.
 *
 * Run:  $env:DATABASE_URL="<url>"; npx tsx scripts/test-service-payment.mts; $env:DATABASE_URL=$null
 */
import { prisma } from "../lib/prisma";
import {
  createServiceOrder,
  paymentDue,
  applyVerifiedPayment,
  publicOrderView,
  getOrderByToken,
} from "../lib/services/orders";

let pass = 0, fail = 0;
const ids: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
}
const reload = (id: string) => prisma.serviceOrder.findUniqueOrThrow({ where: { id } });

async function main() {
  console.log("— ServiceOrder money-logic test —\n");

  // 1) Create a paid order (50k, both services, new customer)
  const a = await createServiceOrder({
    name: "TEST payment (auto-delete)", contact: "test", newCustomer: true,
    words: 50000, services: ["พิสูจน์อักษร & เกลาภาษา", "จัดเรียงหน้า"],
  });
  ids.push(a.id);
  console.log(`order A ${a.quoteNo}`);
  ok(a.status === "AWAITING_DEPOSIT", "new paid order → AWAITING_DEPOSIT");
  ok(a.total === 1520 && a.deposit === 608 && a.balance === 912, `amounts total=${a.total} deposit=${a.deposit} balance=${a.balance} (expect 1520/608/912)`);

  // 2) deposit due
  const due1 = paymentDue(a);
  ok(due1?.phase === "deposit" && due1.amount === 608, "paymentDue → deposit 608");

  // 3) apply deposit
  ok(await applyVerifiedPayment(a.id, "deposit", "TESTREF-A1", null) === true, "apply deposit → true");
  let aR = await reload(a.id);
  ok(aR.status === "IN_PROGRESS" && !!aR.depositPaidAt, "after deposit → IN_PROGRESS + depositPaidAt");

  // 4) idempotency — second apply does nothing
  ok(await applyVerifiedPayment(a.id, "deposit", "TESTREF-A1", null) === false, "re-apply deposit → false (idempotent)");

  // 5) no balance due until delivered
  ok(paymentDue(aR) === null, "paymentDue while IN_PROGRESS → null (no balance yet)");

  // 6) slip-ref dedup across orders
  const b = await createServiceOrder({
    name: "TEST dedup (auto-delete)", contact: "test", newCustomer: true,
    words: 50000, services: ["พิสูจน์อักษร & เกลาภาษา"],
  });
  ids.push(b.id);
  let dup = false;
  try { await applyVerifiedPayment(b.id, "deposit", "TESTREF-A1", null); }
  catch (e) { dup = (e as { code?: string })?.code === "P2002"; }
  ok(dup, "reusing a slip ref on another order → P2002 (blocked)");

  // 7) deliver A (balance > 0 → DELIVERED, file held)
  await prisma.serviceOrder.updateMany({
    where: { id: a.id, status: "IN_PROGRESS" },
    data: { status: "DELIVERED", deliveredAt: new Date(), deliveryUrl: "https://example.com/final.docx" },
  });
  aR = await reload(a.id);
  ok(aR.status === "DELIVERED", "deliver (balance>0) → DELIVERED");
  ok(publicOrderView(aR).deliveryUrl === null, "file link HIDDEN before balance paid");

  // 8) balance due + pay
  const due2 = paymentDue(aR);
  ok(due2?.phase === "balance" && due2.amount === 912, "paymentDue → balance 912");
  ok(await applyVerifiedPayment(a.id, "balance", "TESTREF-A2", null) === true, "apply balance → true");
  aR = await reload(a.id);
  ok(aR.status === "COMPLETED" && !!aR.balancePaidAt, "after balance → COMPLETED + balancePaidAt");
  ok(publicOrderView(aR).deliveryUrl === "https://example.com/final.docx", "file link REVEALED after COMPLETED");

  // 9) free order (≤2500 words) skips deposit + completes on delivery
  const c = await createServiceOrder({
    name: "TEST free (auto-delete)", contact: "test", newCustomer: true,
    words: 2000, services: ["พิสูจน์อักษร & เกลาภาษา"],
  });
  ids.push(c.id);
  ok(c.total === 0 && c.status === "IN_PROGRESS", "free job (total 0) → starts IN_PROGRESS, no deposit");
  ok(paymentDue(c) === null, "free job → nothing due");
  await prisma.serviceOrder.updateMany({
    where: { id: c.id, status: "IN_PROGRESS" },
    data: { status: c.balance > 0 ? "DELIVERED" : "COMPLETED", deliveredAt: new Date(), deliveryUrl: "https://example.com/free.docx" },
  });
  const cR = await reload(c.id);
  ok(cR.status === "COMPLETED", "free job delivery → COMPLETED directly");

  // 10) token lookup
  ok((await getOrderByToken(a.accessToken))?.id === a.id, "getOrderByToken resolves the order");
}

main()
  .catch((e) => { console.error("test crashed:", e); fail++; })
  .finally(async () => {
    if (ids.length) {
      await prisma.serviceOrder.deleteMany({ where: { id: { in: ids } } });
      console.log(`\ncleaned up ${ids.length} test orders`);
    }
    console.log(`\n=== ${pass} passed, ${fail} failed ===`);
    await prisma.$disconnect();
    process.exit(fail ? 1 : 0);
  });
