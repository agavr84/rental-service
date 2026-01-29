import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTbankToken, resolveTbankStatus } from "@/lib/tbank";

export const dynamic = "force-dynamic";

type TbankWebhook = {
  Token?: string;
  OrderId?: string;
  PaymentId?: string | number;
  Status?: string;
  Amount?: number;
};

export async function POST(req: Request) {
  const payload = (await req.json()) as TbankWebhook & Record<string, unknown>;
  const tokenPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      return (
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number"
      );
    })
  ) as Record<string, string | number | null | undefined>;

  const password = process.env.TBANK_PASSWORD;
  if (!password) {
    return new Response("Missing configuration", { status: 500 });
  }

  const receivedToken = payload.Token;
  if (!receivedToken) {
    return new Response("Token required", { status: 400 });
  }

  const expectedToken = buildTbankToken(tokenPayload, password);
  if (receivedToken !== expectedToken) {
    return new Response("Invalid token", { status: 400 });
  }

  const orderId = payload.OrderId ? String(payload.OrderId) : null;
  if (!orderId) {
    return new Response("OK", { status: 200 });
  }

  const paymentId = payload.PaymentId ? String(payload.PaymentId) : null;
  const status = payload.Status ? String(payload.Status) : "UNKNOWN";

  const booking = await prisma.booking.findUnique({
    where: { id: orderId },
  });

  if (!booking) {
    return new Response("OK", { status: 200 });
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId: booking.id },
  });

  const rawWebhook = JSON.parse(JSON.stringify(payload)) as Prisma.JsonObject;

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status,
        tbankPaymentId: paymentId ?? existingPayment.tbankPaymentId,
        amount: payload.Amount ? Number(payload.Amount) : existingPayment.amount,
        rawWebhook,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: payload.Amount ? Number(payload.Amount) : booking.totalPrice * 100,
        status,
        tbankPaymentId: paymentId,
        rawWebhook,
        provider: "TBANK",
      },
    });
  }

  const resolved = resolveTbankStatus(status);

  if (resolved === "PAID" && booking.status !== "PAID") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "PAID" },
    });
  }

  if (
    resolved === "CANCELLED" &&
    booking.status !== "PAID" &&
    booking.status !== "CANCELLED"
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
  }

  return new Response("OK", { status: 200 });
}
