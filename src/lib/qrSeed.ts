export function buildQrSeed(params: {
  reservationId?: string;
  orderId?: string;
  ticketId?: string;
  planLabel: string;
}) {
  return [params.planLabel, params.reservationId, params.orderId, params.ticketId].filter(Boolean).join("|");
}
