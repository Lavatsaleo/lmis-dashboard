import { api } from "../../api/client";

export const canEnterPurchaseOrders = (me) => ["SUPER_ADMIN", "COUNTRY_ADMIN", "WAREHOUSE_OFFICER"].includes(me?.role);

/** Upload a PDF/JPEG/PNG as evidence on a purchase order. */
export function uploadPoDocument(poId, file) {
  const type = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  return api.post(`/api/purchase-orders/${poId}/documents`, file, {
    headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(file.name) },
    transformRequest: [(data) => data],
  });
}

/**
 * Open an authenticated file (document, label sheet) in a new tab. The tab is
 * opened synchronously so browsers do not treat it as a blocked popup.
 * Returns an error message, or "" on success.
 */
export async function openAuthenticatedFile(url, mimeType) {
  const win = window.open("", "_blank");
  try {
    const res = await api.get(url, { responseType: "blob" });
    const blob = new Blob([res.data], { type: mimeType || res.headers["content-type"] || "application/octet-stream" });
    const blobUrl = URL.createObjectURL(blob);
    if (win) {
      win.location.href = blobUrl;
      win.focus();
    } else {
      window.location.href = blobUrl;
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return "";
  } catch (e) {
    if (win) win.close();
    let message = e?.message || "Could not open the file";
    try {
      const text = await e?.response?.data?.text?.();
      message = JSON.parse(text).message || message;
    } catch {
      // keep the generic message
    }
    return message;
  }
}

export const labelSheetUrl = (orderId, goodsReceiptId) =>
  `/api/orders/${orderId}/print/a3${goodsReceiptId ? `?goodsReceiptId=${encodeURIComponent(goodsReceiptId)}` : ""}`;
