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

function nameOf(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name || null;
}

export function assignmentsFrom(call) {
  const rows = [];
  for (const asset of call.assets || []) {
    const listed = Array.isArray(asset.drivers) && asset.drivers.length
      ? asset.drivers
      : [{ driver: asset.driver, truck: asset.truck }];
    for (const row of listed) {
      const driver = row.driver || null;
      const truck = row.truck || asset.truck || null;
      if (!driver && !truck) continue;
      rows.push({
        driverId: driver?.id ?? row.driverId ?? null,
        driverName: driver?.name ?? null,
        truckId: truck?.id ?? null,
        truckName: truck?.name ?? null,
        responseStatusId: driver?.responseStatusId ?? null,
      });
    }
  }
  return rows;
}

function vehicleOf(asset) {
  if (!asset) return null;
  const body = nameOf(asset.bodyType);
  const label = [asset.year, asset.make, asset.model, body].filter(Boolean).join(" ");
  return label || null;
}

function attributeValue(call, attributeId) {
  const found = (call.attributes || []).find((item) => item.attributeId === attributeId);
  return found ? found.value ?? "" : null;
}

export function billingPacket({ call = {}, payments, internalNoteList, account, accountNoteList } = {}) {
  const warnings = [];
  const people = assignmentsFrom(call);
  const asset = call.assets?.[0] || null;
  const weightClass = call.weightClass || call.weightClassName || asset?.weightClass || asset?.weightClassName || null;
  if (!weightClass) warnings.push("No weightClass field on the job. It was not inferred.");

  let internalNotes = [];
  if (internalNoteList?.error) {
    warnings.push(`Internal note history was not loaded: ${internalNoteList.error}`);
  } else if (!Array.isArray(internalNoteList)) {
    warnings.push("Internal note history was not a list. Call notes were not copied into it.");
  } else {
    internalNotes = internalNoteList.map((note) => ({
      id: note.id ?? null,
      text: note.content ?? note.text ?? note.note ?? "",
      author: note.ownerName ?? note.authorName ?? null,
      authorId: note.ownerUserId ?? note.authorId ?? null,
      timestamp: note.createDate ?? note.date ?? null,
    }));
    if (internalNotes.length === 0) warnings.push("Internal note history is empty.");
  }

  const billingNotes = attributeValue(call, 47);
  if (billingNotes === null) warnings.push("Billing notes attribute 47 was not on the job.");

  let accountNotes = "";
  let accountNoteHistory = [];
  if (!account) warnings.push("No bill-to account id on the job.");
  else if (account.error) warnings.push(`Account record was not loaded: ${account.error}`);
  else accountNotes = account.notes || account.accountNotes || "";

  if (accountNoteList?.error) warnings.push(`Account note history was not loaded: ${accountNoteList.error}`);
  else if (Array.isArray(accountNoteList)) {
    accountNoteHistory = accountNoteList.map((note) => ({
      id: note.id ?? null,
      title: note.title ?? null,
      text: note.note ?? note.text ?? note.content ?? "",
      author: note.authorName ?? null,
      authorId: note.authorId ?? null,
      timestamp: note.createDate ?? note.date ?? null,
      type: note.type ?? null,
    }));
  }

  const paymentList = Array.isArray(payments) ? payments : [];
  if (payments?.error) warnings.push(`Payments were not loaded: ${payments.error}`);

  return {
    callNumber: call.callNumber ?? null,
    invoiceNumber: call.invoiceNumber || null,
    purchaseOrderNumber: call.purchaseOrderNumber || call.poNumber || null,
    drivers: people,
    driver: people[0]?.driverName || null,
    truck: people[0]?.truckName || null,
    vehicle: vehicleOf(asset),
    vin: asset?.vin || null,
    weightClass,
    invoiceItems: call.invoiceItems || [],
    invoiceSubtotal: call.invoiceSubtotal ?? null,
    invoiceTax: call.invoiceTax ?? null,
    invoiceTotal: call.invoiceTotal ?? null,
    payments: paymentList,
    balanceDue: call.balanceDue ?? null,
    callNotes: call.notes || "",
    billingNotes: billingNotes || "",
    internalNotes,
    accountNotes,
    accountNoteHistory,
    commissionAllocation: {
      meaning: "TowBook allocation settings. Not calculated payroll earnings.",
      totalTicketValue: call.commissions?.totalTicketValue ?? null,
      drivers: call.commissions?.drivers || [],
    },
    warnings,
  };
}
