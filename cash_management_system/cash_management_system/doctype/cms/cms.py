# Copyright (c) 2024, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class CMS(Document):

    def validate(self):
        if self.custodian_1 == self.custodian_2:
            frappe.throw("Please Change Custodians, both cannot be the same!!")
        if self.select_branch == "Other Branch" and self.requested_branch == "Gondia HO":
            frappe.throw("Please select a branch other than 'Gondia HO'.")
        if self.amount == 0:
           frappe.throw("Amount Cannot be Zero '0'")

    def before_save(self):
        # Convert fields to uppercase if they exist
        if self.ifsc_code:
            self.ifsc_code = self.ifsc_code.upper()
        if self.account_number:
            self.account_number = self.account_number.upper()
        if self.cheque_number:
            self.cheque_number = self.cheque_number.upper()

        # Set the stage_1_emp_user field using the get_com method
        self.stage_1_emp_user = self.get_com(self.branch)   

    def get_com(self, branch):
        # Fetch the 'employee' field from the 'COM Mapping' doctype based on the branch
        com = frappe.db.get_value('COM Mapping', branch, 'employee')
        
        # If com is found, concatenate it with '@sahayog.com'
        if com:
            return f"{com}@sahayog.com"
        
        # If com is not found, return None
        return None





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