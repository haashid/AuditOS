import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import random

pdf_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "invoice_JE_005.pdf")

def create_invoice():
    c = canvas.Canvas(pdf_path, pagesize=letter)
    
    # Title
    c.setFont("Helvetica-Bold", 28)
    c.drawString(50, 750, "INVOICE")
    
    # Vendor Info
    c.setFont("Helvetica", 12)
    c.drawString(50, 700, "FROM:")
    c.drawString(50, 680, "Global Tech Solutions LLC")
    c.drawString(50, 660, "456 Enterprise Way, Suite 200")
    c.drawString(50, 640, "San Francisco, CA 94105")
    
    # Client Info
    c.drawString(350, 700, "TO:")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(350, 680, "Acme Corporation")
    c.setFont("Helvetica", 12)
    c.drawString(350, 660, "100 Main Street")
    c.drawString(350, 640, "New York, NY 10001")
    
    # Invoice Details
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 580, "Invoice Number: INV-2024-8842")
    c.setFont("Helvetica", 12)
    c.drawString(50, 560, "Date: January 25, 2024")
    c.drawString(50, 540, "Terms: Net 15")
    c.drawString(50, 520, "Due Date: February 9, 2024")
    
    # Table Header
    c.line(50, 480, 550, 480)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 465, "Description")
    c.drawString(450, 465, "Amount (USD)")
    c.line(50, 455, 550, 455)
    
    # Table Content
    c.setFont("Helvetica", 12)
    c.drawString(50, 430, "Software Licensing and Enterprise Support (Q1)")
    c.drawString(450, 430, "150,000.00")
    
    c.drawString(50, 400, "Implementation Services & Custom Development")
    c.drawString(450, 400, "50,000.00")
    
    # Totals
    c.line(50, 370, 550, 370)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(300, 340, "Total Amount Due:")
    c.drawString(450, 340, "200,000.00")
    
    # Footer
    c.setFont("Helvetica", 10)
    c.drawString(50, 100, "Please make checks payable to Global Tech Solutions LLC.")
    c.drawString(50, 85, "If you have any questions about this invoice, please contact billing@globaltech.example.com")
    
    c.save()
    print(f"Successfully generated invoice at {pdf_path}")

if __name__ == "__main__":
    create_invoice()
