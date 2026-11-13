function textOf(cell) {
  return String(cell || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function parseHtmlTable(html) {
  const table = String(html || "").match(/<table[\s\S]*?<\/table>/i);
  if (!table) return { headers: [], rows: [] };
  const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textOf(cell[1]))
  );
  const headers = rows.find((row) => row.some(Boolean)) || [];
  const body = rows.slice(rows.indexOf(headers) + 1).filter((row) => row.some(Boolean));
  return {
    headers,
    rows: body.map((cells) => {
      const record = {};
      headers.forEach((header, i) => {
        if (header) record[header] = cells[i] || "";
      });
      return record;
    }),
  };
}

export function billingRow({ call = {}, payments = [], notes = [], account = {} } = {}) {
  const list = Array.isArray(payments) ? payments : payments?.items || payments?.payments || [];
  const noteList = Array.isArray(notes) ? notes : notes?.items || notes?.notes || [];
  const contact = (call.contacts || []).find((item) => item?.driversLicense) || call.contacts?.[0] || {};
  const paymentSummary = list.map((payment) => ({
    type: payment.paymentType || payment.type || payment.method || null,
    amount: payment.amount ?? null,
    date: payment.paymentDate || payment.date || payment.createDate || null,
    reference: payment.referenceNumber || payment.checkNumber || null,
  }));
  return {
    driver: call.driver || call.owner?.name || null,
    driverLicenseNumber: call.driverLicenseNumber || call.driversLicense || contact.driversLicense || null,
    truck: call.truck || null,
    dateTime: call.createDate || call.completedDate || null,
    vehicle: call.vehicle || call.assets?.[0]?.description || null,
    vin: call.vin || call.assets?.[0]?.vin || null,
    callNumber: call.callNumber ?? null,
    invoiceNumber: call.invoiceNumber || null,
    account: call.account?.name || call.billToAccountName || call.accountName || account.name || null,
    purchaseOrderNumber: call.purchaseOrderNumber || call.poNumber || null,
    weightClass: call.weightClass || call.weightClassName || call.assets?.[0]?.weightClass || null,
    invoiceTotal: call.invoiceTotal ?? null,
    payments: paymentSummary,
    paymentsTotal: call.paymentsApplied ?? null,
    balanceDue: call.balanceDue ?? account.balance ?? null,
    paymentStatus: call.paymentStatus || call.status?.name || null,
    driverBase: call.driverBase ?? null,
    commission: call.commission ?? call.commissions ?? null,
    internalBillingNotes: call.billingNotes || noteText(noteList) || call.notes || "",
    accountNotes: account.accountNotes || account.notes || "",
  };
}

function noteText(notes) {
  return notes
    .map((note) => note?.text || note?.note || note?.body || note?.value || "")
    .filter(Boolean)
    .join("\n");
}
