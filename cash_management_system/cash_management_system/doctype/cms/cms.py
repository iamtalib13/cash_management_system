# Copyright (c) 2024, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate
from frappe.utils.pdf import get_pdf  # Import get_pdf directly

class CMS(Document):
    def check_cheque_details(self):
            all_fields_non_empty = True  # Flag to track if all fields are non-empty

            # Loop through each row in the cheque_details child table
            for row in self.cheque_details:
                # Check if cheque_number and cheque_amount are non-empty
                if not row.cheque_number or not row.cheque_amount:
                    all_fields_non_empty = False  # Set flag to false if any field is empty

            # Now you can take action based on the all_fields_non_empty flag
            if not all_fields_non_empty:
                # Raise a validation error if any field is empty
                frappe.throw("Please ensure that 'cheque_number' and 'cheque_amount' are filled in all entries.")
    def check_amount_details(self):
            all_fields_non_empty = True  # Flag to track if all fields are non-empty

            # Loop through each row in the cheque_details child table
            for row in self.cheque_details:
                # Check if cheque_number and cheque_amount are non-empty
                if not row.cheque_amount:
                    all_fields_non_empty = False  # Set flag to false if any field is empty

            # Now you can take action based on the all_fields_non_empty flag
            if not all_fields_non_empty:
                # Raise a validation error if any field is empty
                frappe.throw("Please Fill Amount.")            

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

        if self.transaction_category == "CIT" and self.transaction_type == "ACCOUNT TRANSFER":
           self.check_cheque_details()

        if self.transaction_category == "WITHDRAWAL":
           self.check_cheque_details()      
        
        if self.transaction_category == "DEPOSIT":
           self.check_amount_details()         

    def before_save(self):
        if self.status == "Rejected":
            # Clear all records in the cheque_details child table
            self.cheque_details.clear()
        elif self.cheque_details:
            # Sum the cheque_amount from the child table and store in self.amount
            if self.transaction_type!="CASH":
               total_amount = 0
               for cheque in self.cheque_details:
                   total_amount += float(cheque.cheque_amount or 0)  # Ensure to handle None values safely
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
    try:
        # Fetch the document
        doc = frappe.get_doc("CMS", name)  

        # Initialize the context dictionary
        context = {
            "doc": doc,  # Include the doc object
            "employee_details": {},
            "custodian_1_details": {},
            "custodian_2_details": {},
            "stage_1_emp_user_details": {},
            "stage_2_emp_user_details": {},
            "stage_1_emp_id": None,  # Add to store the employee ID
            "stage_2_emp_id": None   # Add to store the employee ID
        }

        # Fetch employee details
        if doc.employee:
            context["employee_details"] = fetch_employee(doc.employee)

        # Fetch custodian 1 details
        if doc.custodian_1:
            context["custodian_1_details"] = fetch_employee(doc.custodian_1)

        # Fetch custodian 2 details
        if doc.custodian_2:
            context["custodian_2_details"] = fetch_employee(doc.custodian_2)

        # Extract employee IDs from stage_1_emp_user and stage_2_emp_user
        stage_1_emp_id = doc.stage_1_emp_user.split('@')[0] if doc.stage_1_emp_user else None
        stage_2_emp_id = doc.stage_2_emp_user.split('@')[0] if doc.stage_2_emp_user else None

          # Store the extracted employee IDs in the context
        context["stage_1_emp_id"] = stage_1_emp_id
        context["stage_2_emp_id"] = stage_2_emp_id


        # Fetch stage employee user details
        if stage_1_emp_id:
            context["stage_1_emp_user_details"] = fetch_employee(stage_1_emp_id)

        if stage_2_emp_id:
            context["stage_2_emp_user_details"] = fetch_employee(stage_2_emp_id)
        
        # Render the HTML template
        html = frappe.render_template("cash_management_system/templates/dynamic_pdf_template.html", context)
        
        # Check if HTML rendering is successful
        if not html:
            frappe.throw("Failed to render HTML template.")
        
        # Generate PDF with zero margins
        pdf_data = get_pdf(html)

        # Return the PDF content as binary data
        frappe.local.response.filecontent = pdf_data
        frappe.local.response.type = "download"
        frappe.local.response.filename = f"{name}_Document_Details.pdf"
        return pdf_data
    
    except Exception as e:
        # Log the error with traceback
        frappe.log_error(frappe.get_traceback(), f"PDF Generation Error: {str(e)}")
        
        # Set the response status and error message
        frappe.local.response.status_code = 500
        frappe.local.response.message = str(e)
        
        return {"error": str(e)}

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