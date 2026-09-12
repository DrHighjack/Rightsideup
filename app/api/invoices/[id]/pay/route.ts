export async function POST(
  _request: Request,
  _context: { params: { id: string } }
) {
  return Response.json(
    { error: "This payment path has been retired. Use the invoice payment page." },
    { status: 410 }
  );
}
