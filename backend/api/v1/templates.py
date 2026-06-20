from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
import csv

router = APIRouter()

TEMPLATES = {
    "sap": [
        "transaction_date", "document_number", "account_code", "account_name", 
        "debit_amount", "credit_amount", "currency", "description", "posted_by",
        "company_code", "cost_center", "profit_center"
    ],
    "oracle": [
        "transaction_date", "document_number", "account_code", "account_name", 
        "debit_amount", "credit_amount", "currency", "description", "posted_by",
        "ledger_id", "operating_unit"
    ],
    "dynamics": [
        "transaction_date", "document_number", "account_code", "account_name", 
        "debit_amount", "credit_amount", "currency", "description", "posted_by",
        "dimension_1", "dimension_2"
    ],
    "tally": [
        "transaction_date", "document_number", "account_code", "account_name", 
        "debit_amount", "credit_amount", "currency", "description", "posted_by",
        "voucher_type", "party_name"
    ],
    "generic": [
        "transaction_date", "document_number", "account_code", "account_name", 
        "debit_amount", "credit_amount", "currency", "description", "posted_by"
    ],
    "itsm_changes": [
        "change_id", "change_type", "description", "requested_by", 
        "approved_by", "implemented_by", "change_date", "environment", 
        "has_rollback_plan", "was_tested"
    ]
}

@router.get("/templates/{erp_type}/download")
def download_template(erp_type: str):
    """Download a pre-formatted CSV template for manual upload."""
    if erp_type not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header row
    writer.writerow(TEMPLATES[erp_type])
    
    # Write one sample data row
    if erp_type == "itsm_changes":
        writer.writerow([
            "CHG-1001", "normal", "Update DB schema", "dev.team", 
            "cto@company.com", "db.admin", "2024-03-15", "production",
            "true", "true"
        ])
    else:
        writer.writerow([
            "2024-01-15", "DOC-001", "1000", "Cash", 
            "150.00", "0.00", "USD", "Sample Transaction", "system_user"
        ] + [""] * (len(TEMPLATES[erp_type]) - 9))

    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=AuditOS_{erp_type.capitalize()}_Template.csv"}
    )
