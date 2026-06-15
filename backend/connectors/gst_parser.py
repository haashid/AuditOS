"""
GST Return File Parser
Supports JSON format (downloaded from GSTN portal)
and Excel format (common for older filings).
"""
import json
import pandas as pd
from decimal import Decimal

def parse_gstr1_json(file_content: bytes) -> dict:
    """
    Parse GSTR-1 JSON file downloaded from GSTN portal.
    Returns normalized summary dict.
    """
    try:
        data = json.loads(file_content)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format. Download GSTR-1 as JSON from GSTN portal.")

    summary = {
        "gstin": data.get("gstin", ""),
        "filing_period": data.get("fp", ""),   # format: MMYYYY
        "return_type": "GSTR-1",
        "total_taxable_value": Decimal("0"),
        "total_igst": Decimal("0"),
        "total_cgst": Decimal("0"),
        "total_sgst": Decimal("0"),
        "b2b_invoices": [],  # Business-to-business invoices
        "b2c_invoices": [],  # Business-to-consumer invoices
    }

    # B2B supplies (business to business)
    for b2b in data.get("b2b", []):
        for invoice in b2b.get("inv", []):
            for item in invoice.get("itms", []):
                detail = item.get("itm_det", {})
                taxval = Decimal(str(detail.get("txval", 0)))
                igst = Decimal(str(detail.get("iamt", 0)))
                cgst = Decimal(str(detail.get("camt", 0)))
                sgst = Decimal(str(detail.get("samt", 0)))

                summary["total_taxable_value"] += taxval
                summary["total_igst"] += igst
                summary["total_cgst"] += cgst
                summary["total_sgst"] += sgst

                summary["b2b_invoices"].append({
                    "gstin": b2b.get("ctin"),
                    "invoice_number": invoice.get("inum"),
                    "invoice_date": invoice.get("idt"),
                    "invoice_value": invoice.get("val"),
                    "taxable_value": float(taxval),
                    "igst": float(igst),
                    "cgst": float(cgst),
                    "sgst": float(sgst),
                })

    # B2C large (business to consumer, value > 2.5 lakh)
    for b2cl in data.get("b2cl", []):
        for invoice in b2cl.get("inv", []):
            for item in invoice.get("itms", []):
                detail = item.get("itm_det", {})
                taxval = Decimal(str(detail.get("txval", 0)))
                summary["total_taxable_value"] += taxval
                summary["total_igst"] += Decimal(str(detail.get("iamt", 0)))

    # Convert Decimal to float for JSON serialization
    summary["total_taxable_value"] = float(summary["total_taxable_value"])
    summary["total_igst"] = float(summary["total_igst"])
    summary["total_cgst"] = float(summary["total_cgst"])
    summary["total_sgst"] = float(summary["total_sgst"])
    summary["total_tax"] = (
        summary["total_igst"] + summary["total_cgst"] + summary["total_sgst"]
    )

    return summary


def parse_gstr3b_json(file_content: bytes) -> dict:
    """
    Parse GSTR-3B JSON file.
    GSTR-3B has a simpler structure — just summary figures.
    """
    try:
        data = json.loads(file_content)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON. Download GSTR-3B as JSON from GSTN portal.")

    sup_details = data.get("sup_details", {})
    itc_elg = data.get("itc_elg", {}).get("itc_avl", [{}])[0]

    return {
        "gstin": data.get("gstin", ""),
        "filing_period": data.get("ret_period", ""),
        "return_type": "GSTR-3B",
        "total_taxable_value": float(sup_details.get("osup_det", {}).get("txval", 0)),
        "total_igst": float(sup_details.get("osup_det", {}).get("iamt", 0)),
        "total_cgst": float(sup_details.get("osup_det", {}).get("camt", 0)),
        "total_sgst": float(sup_details.get("osup_det", {}).get("samt", 0)),
        "itc_claimed_igst": float(itc_elg.get("iamt", 0)),
        "itc_claimed_cgst": float(itc_elg.get("camt", 0)),
        "itc_claimed_sgst": float(itc_elg.get("samt", 0)),
        "total_tax": float(
            sup_details.get("osup_det", {}).get("iamt", 0) +
            sup_details.get("osup_det", {}).get("camt", 0) +
            sup_details.get("osup_det", {}).get("samt", 0)
        ),
        "raw_data": data
    }


def parse_gstr2b_json(file_content: bytes) -> dict:
    """
    Parse GSTR-2B JSON — auto-generated ITC statement.
    Shows what ITC is AVAILABLE based on supplier filings.
    """
    try:
        data = json.loads(file_content)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON. Download GSTR-2B from GSTN portal.")

    itc_available = []
    data_section = data.get("data", {})

    for document in data_section.get("docdata", {}).get("b2b", []):
        supplier_gstin = document.get("ctin")
        supplier_name = document.get("trdnm", "")

        for doc in document.get("doc", []):
            for item in doc.get("itms", []):
                itc_available.append({
                    "supplier_gstin": supplier_gstin,
                    "supplier_name": supplier_name,
                    "invoice_number": doc.get("docnum"),
                    "invoice_date": doc.get("docdt"),
                    "taxable_value": float(item.get("txval", 0)),
                    "igst": float(item.get("igst", 0)),
                    "cgst": float(item.get("cgst", 0)),
                    "sgst": float(item.get("sgst", 0)),
                    "itc_eligible": item.get("elgsts") == "Eligible"
                })

    total_igst = sum(i["igst"] for i in itc_available if i["itc_eligible"])
    total_cgst = sum(i["cgst"] for i in itc_available if i["itc_eligible"])
    total_sgst = sum(i["sgst"] for i in itc_available if i["itc_eligible"])

    return {
        "return_type": "GSTR-2B",
        "filing_period": data.get("data", {}).get("rtnprd", ""),
        "gstin": data.get("data", {}).get("gstin", ""),
        "total_igst": total_igst,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_tax": total_igst + total_cgst + total_sgst,
        "itc_line_items": itc_available,
        "total_taxable_value": sum(i["taxable_value"] for i in itc_available)
    }


def parse_26as_csv(file_content: bytes) -> list[dict]:
    """
    Parse 26AS CSV/Excel export from Income Tax portal.
    Returns list of TDS records.
    """
    import io
    try:
        df = pd.read_csv(io.BytesIO(file_content), skiprows=1)
    except Exception:
        try:
            df = pd.read_excel(io.BytesIO(file_content), skiprows=1)
        except Exception:
            raise ValueError("Could not parse 26AS file. Export as CSV or Excel from IT portal.")

    # Normalize column names (26AS format varies slightly between years)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    records = []
    for _, row in df.iterrows():
        try:
            records.append({
                "deductor_name": str(row.get("name_of_deductor", "")),
                "deductor_tan": str(row.get("tan_of_deductor", "")),
                "section": str(row.get("section", "")),
                "payment_date": str(row.get("date_of_payment_credit", "")),
                "payment_amount": float(str(row.get("amount_paid_credited", "0")
                                           ).replace(",", "") or 0),
                "tds_amount": float(str(row.get("tax_deducted", "0"))
                                      .replace(",", "") or 0),
                "source": "26AS"
            })
        except (ValueError, TypeError):
            continue  # Skip malformed rows

    return records
