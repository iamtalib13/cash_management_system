# Copyright (c) 2024, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate

class CMS(Document):

    def validate(self):
        if not self.stage_1_emp_status:
           self.check_transaction_date()
                  
        if self.custodian_1 == self.custodian_2:
            frappe.throw("Please Change Custodians, both cannot be the same!!")
        if self.select_branch == "Other Branch" and self.requested_branch == "Gondia HO":
            frappe.throw("Please select a branch other than 'Gondia HO'.")
        if self.amount == 0:
           frappe.throw("Amount Cannot be Zero '0'")

        if self.transaction_type=="CASH":
           if self.amount == 0:
               frappe.throw("Amount Cannot be Zero")
           

    def before_save(self):
        if self.status == "Rejected":
            # Clear all records in the cheque_details child table
            self.cheque_details.clear()
        elif self.cheque_details:
            # Sum the cheque_amount from the child table and store in self.amount
            if self.transaction_type!="CASH":
               total_amount = 0
               for cheque in self.cheque_details:
                   total_amount += cheque.cheque_amount or 0  # Ensure to handle None values safely
               self.amount = total_amount 

        # Convert fields to uppercase if they exist
        # if self.ifsc_code:
        #     self.ifsc_code = self.ifsc_code.upper()
        # if self.account_number:
        #     self.account_number = self.account_number.upper()
        # if self.cheque_number:
        #     self.cheque_number = self.cheque_number.upper()

        # Set the stage_1_emp_user field using the get_com method
        self.stage_1_emp_user = self.get_com(self.branch)   


    def check_transaction_date(self):
        # Get the current date
        current_date = nowdate()

        # Check if the transaction date is in the past
        if self.date_of_transaction < current_date:
            # Raise a validation error if the date is in the past
            frappe.throw(_("Transaction date cannot be in the past. Please select the current date or a future date."))


    def get_com(self, branch):
        # Fetch the 'employee' field from the 'COM Mapping' doctype based on the branch
        com = frappe.db.get_value('COM Mapping', branch, 'employee')
        
        # If com is found, concatenate it with '@sahayog.com'
        if com:
            return f"{com}@sahayog.com"
        
        # If com is not found, return None
        return None

@frappe.whitelist()
def generate_dynamic_pdf(name):
    doc = frappe.get_doc("CMS", name)  # Adjust this with the relevant doctype and docname
    html = frappe.render_template("templates/dynamic_pdf_template.html", {"doc": doc})
    pdf = frappe.utils.pdf.get_pdf(html)

    # Return the PDF content as binary data
    frappe.local.response.filecontent = pdf
    frappe.local.response.type = "download"
    frappe.local.response.filename = "Document_Details.pdf"
    return pdf

@frappe.whitelist()
def fetch_employee(employee_id):
    # Use parameterized query to prevent SQL injection
    sql_query = """
        SELECT CONCAT(first_name, ' ', last_name) AS employee_name, designation, branch, region, district, zone,department, division, cell_number
        FROM `tabEmployee`
        WHERE employee_id=%s
    """
    # Execute the query with the provided employee_id
    result = frappe.db.sql(sql_query, (employee_id,), as_dict=True)
    
    return result


@frappe.whitelist()
def get_server_datetime():
    return frappe.utils.now_datetime()

@frappe.whitelist()
def get_employees_by_branch(doctype, txt, searchfield, start, page_len, filters):
    # Extract the branch from filters
    branch = filters.get('branch')

    if not branch:
        return []

    # Search for employees by branch and name
    employees = frappe.get_all(
        'Employee',
        filters={
            'branch': branch,
            'name': ['like', f"%{txt}%"]  # Search by name
        },
        fields=['name', 'employee_name'],
        limit_start=start,
        limit_page_length=page_len
    )

    # Format the results as a list of tuples
    result = [(emp['name'], emp['employee_name']) for emp in employees]

    return result
@frappe.whitelist()
def ping():
    return "pong....reply aa gya"

@frappe.whitelist()
def before_print(doc, print_format=None):
    # Fetch additional data
    additional_data = frappe.db.get_value('Another Doctype', {'doc_name': doc.name}, 'desired_field')
    # Attach it to the document context
    doc.additional_data = additional_data