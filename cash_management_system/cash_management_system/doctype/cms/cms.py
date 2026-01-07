# Copyright (c) 2024, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate
from frappe.utils.pdf import get_pdf  # Import get_pdf directly
from frappe.utils import now_datetime
from frappe.utils import escape_html




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

        if self.transaction_category == "CIT" and self.transaction_type == "ACCOUNT TRANSFER" and self.select_branch != "Other Branch":
           self.check_cheque_details()

        if self.transaction_category == "WITHDRAWAL":
           self.check_cheque_details()      
        
        if self.transaction_category == "DEPOSIT":
           self.check_amount_details()         

    def before_save(self):
        # --------------------------------------------------
        # 1. Preserve child table on Reject / Approve
        # --------------------------------------------------
        if not self.is_new() and self.status in ("Rejected", "Approved"):
            old_doc = frappe.get_doc(self.doctype, self.name)
            self.cheque_details = old_doc.cheque_details

        # --------------------------------------------------
        # 2. Recalculate amount ONLY when editable
        # --------------------------------------------------
        if self.transaction_type != "CASH" and self.cheque_details:
            total_amount = 0
            for cheque in self.cheque_details:
                total_amount += float(cheque.cheque_amount or 0)
            self.amount = total_amount
    
    def before_insert(self):
        self.set_com_email()
                   
    def set_com_email(self):
        self.stage_1_emp_user = self.get_com(self.branch)  
        # Fetch the employee's email where user_id matches self.stage_1_emp_user
        com_email = frappe.db.get_value('Employee', {'user_id': self.stage_1_emp_user}, 'company_email')
        
        # Set the email value if found
        if com_email:
            self.com_email = com_email
        else:
            frappe.msgprint(f"No email found for user: {self.com_email}")
        # Convert fields to uppercase if they exist
        # if self.ifsc_code:
        #     self.ifsc_code = self.ifsc_code.upper()
        # if self.account_number:
        #     self.account_number = self.account_number.upper()
        # if self.cheque_number:
        #     self.cheque_number = self.cheque_number.upper()

        # Set the stage_1_emp_user field using the get_com method
         


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
    # --------------------------------------------------
    # EMAIL TRIGGERS (SAFE & RELIABLE)
    # --------------------------------------------------
    def on_update(self):
        old = self._doc_before_save
        if not old:
            return

        # COM approval / rejection
        if old.stage_1_emp_status != self.stage_1_emp_status:
            frappe.msgprint("inside com status change")
            if self.stage_1_emp_status == "Approved":
                # frappe.msgprint("inside com approved")
                send_status_email(
                    self,
                    "Approved by COM",
                    self.stage_1_emp_remark
                )

            elif self.stage_1_emp_status == "Rejected":
                # frappe.msgprint("inside com rejected")
                send_status_email(
                    self,
                    "Rejected by COM",
                    self.stage_1_emp_remark
                )

        # HO approval / rejection
        if old.stage_2_emp_status != self.stage_2_emp_status:
            frappe
            if self.stage_2_emp_status == "Approved":
                # frappe.msgprint("inside ho approved")
                send_status_email(
                    self,
                    "Approved by Head Office",
                    self.stage_2_emp_remark
                )

            elif self.stage_2_emp_status == "Rejected":
                # frappe.msgprint("inside ho rejected")
                send_status_email(
                    self,
                    "Rejected by Head Office",
                    self.stage_2_emp_remark,
                    
                )
import frappe
from frappe.utils import get_url_to_form, escape_html


def send_status_email(doc, action, remark=None):
    # --------------------------------------------------
    # 1. Get recipient email from Employee.company_email
    # --------------------------------------------------
    employee_email = frappe.db.get_value(
        "Employee",
        {"user_id": doc.owner},
        "company_email"
    )

    if not employee_email:
        frappe.log_error(
            f"No company_email found for user {doc.owner}",
            "CMS Email Error"
        )
        return

    recipients = [employee_email]

    # --------------------------------------------------
    # 2. Record URL
    # --------------------------------------------------
    record_url = get_url_to_form(doc.doctype, doc.name)

    # --------------------------------------------------
    # 3. Approval progress step (TEXT → CIRCLE)
    # --------------------------------------------------
    def step(label, status):
        color = {
            "Approved": "#16a34a",
            "Rejected": "#dc2626",
            "Pending": "#f59e0b"
        }.get(status, "#9ca3af")

        return f"""
        <div style="flex:1;text-align:center;width:100%;">

            <!-- Label + Status -->
            <div style="font-size:12px;color:#374151;margin-bottom:8px;">
                {label}<br>
                <b>{status}</b>
            </div>

            <!-- Circle BELOW -->
            <div style="
                margin:0 auto;
                width:28px;
                height:28px;
                border-radius:50%;
                background:{color};
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:14px;
            ">
                ✓
            </div>

        </div>
        """

    stage_1 = doc.stage_1_emp_status or "Pending"
    stage_2 = doc.stage_2_emp_status or "Pending"
    final_status = doc.status or "Pending"

    # --------------------------------------------------
    # 4. Subject
    # --------------------------------------------------
    subject = f"CMS Request {doc.name} – {action}"

    # --------------------------------------------------
    # 5. Email HTML
    # --------------------------------------------------
    message = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:20px;">
      <div style="
        max-width:650px;
        margin:auto;
        background:white;
        border-radius:10px;
        box-shadow:0 10px 25px rgba(0,0,0,.08);
        overflow:hidden;
      ">

        <!-- Header -->
        <div style="
          background:#0f766e;
          padding:18px;
          color:white;
          text-align:center;
          font-size:18px;
          font-weight:bold;
        ">
          Cash Management System
        </div>

        <!-- Body -->
        <div style="padding:22px;color:#111827;">

          <p style="font-size:15px;">Hello,</p>

          <p style="font-size:15px;">
            Your CMS request <b>{doc.name}</b> has been
            <b style="color:#0f766e;">{escape_html(action)}</b>.
          </p>

          <!-- Remarks -->
          {f'''
          <div style="
            background:#fef3c7;
            border-left:5px solid #f59e0b;
            padding:12px;
            margin:16px 0;
            font-size:14px;
          ">
            <b>Remarks:</b><br>
            {escape_html(remark)}
          </div>
          ''' if remark else ""}

          <!-- Progress -->
          <div style="margin:22px 0;">
            <div style="font-weight:bold;margin-bottom:10px;">
              Approval Progress
            </div>

            <div style="
              display:flex;
              gap:10px;
              background:#f9fafb;
              padding:14px;
              border-radius:8px;
              border:1px solid #e5e7eb;
            ">
              {step("COM Approval", stage_1)}
              {step("HO Approval", stage_2)}
              {step("Final Status", final_status)}
            </div>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0;">
            <a href="{record_url}" target="_blank"
               style="
                background:#0f766e;
                color:white;
                padding:12px 22px;
                text-decoration:none;
                border-radius:6px;
                font-size:14px;
                font-weight:bold;
                display:inline-block;
               ">
              Open CMS Request
            </a>
          </div>

          <p style="font-size:13px;color:#6b7280;">
            Please login to the system for more details.
          </p>

        </div>

        <!-- Footer -->
        <div style="
          background:#f9fafb;
          padding:14px;
          text-align:center;
          font-size:12px;
          color:#6b7280;
        ">
          This is an automated notification.<br>
          Cash Management System
        </div>

      </div>
    </div>
    """

    # --------------------------------------------------
    # 6. Send Email
    # --------------------------------------------------
    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=message,
        now=True
    )


# sejd the pending approval reminders
import frappe
from frappe.utils import date_diff, nowdate


def get_pending_cms_requests():
    """
    Returns:
    [
        {
            "cms_name": "...",
            "level": "COM" | "HO",
            "email": "...",
            "pending_days": X
        }
    ]
    """

    results = []

    cms_docs = frappe.get_all(
        "CMS",
        filters={"status": "Pending"},
        fields=[
            "name",
            "stage_1_emp_status",
            "stage_2_emp_status",
            "modified"
        ],
    )

    # --------------------------------------------------
    # Resolve COM & HO from CMS User
    # --------------------------------------------------
    com_user = frappe.db.get_value(
        "CMS User",
        {"status": "COM-Approver"},
        "name"
    )

    ho_user = frappe.db.get_value(
        "CMS User",
        {"status": "HO-Approver"},
        "name"
    )

    com_email = frappe.db.get_value(
        "Employee",
        {"user_id": com_user},
        "company_email"
    ) if com_user else None

    ho_email = frappe.db.get_value(
        "Employee",
        {"user_id": ho_user},
        "company_email"
    ) if ho_user else None

    today = nowdate()

    for doc in cms_docs:
        pending_days = date_diff(today, doc.modified)

        # ---------------- COM Pending ----------------
        if doc.stage_1_emp_status == "Pending" and com_email:
            results.append({
                "cms_name": doc.name,
                "level": "COM",
                "email": com_email,
                "pending_days": pending_days
            })

        # ---------------- HO Pending ----------------
        elif (
            doc.stage_1_emp_status == "Approved"
            and doc.stage_2_emp_status == "Pending"
            and ho_email
        ):
            results.append({
                "cms_name": doc.name,
                "level": "HO",
                "email": ho_email,
                "pending_days": pending_days
            })

    return results

def send_pending_approval_emails():
    pending_items = get_pending_cms_requests()

    if not pending_items:
        frappe.logger().info("CMS Reminder: No pending approvals")
        return

    for item in pending_items:
        cms_name = item["cms_name"]
        email = item["email"]
        level = item["level"]
        days = item["pending_days"]

        record_url = get_url_to_form("CMS", cms_name)

        subject = f"CMS Approval Pending ({days} days): {cms_name}"

        message = f"""
        <p>Hello,</p>

        <p>
            CMS request <b>{cms_name}</b> is pending for
            <b>{level} approval</b>.
        </p>

        <p style="margin:10px 0;
        padding:10px;
        background:#fff7ed;
        border-left:4px solid #f97316;">
            ⏳ <b>Pending since:</b> {days} day(s)
        </p>

        <p>
            👉 <a href="{record_url}" target="_blank">
            Click here to review the request
            </a>
        </p>

        <br>
        <p>Regards,<br>
        <b>Cash Management System</b></p>
        """

        frappe.sendmail(
            recipients=[email],
            subject=subject,
            message=message,
            now=True
        )

        frappe.logger().info(
            f"CMS Reminder Sent | {cms_name} | {level} | {days} days"
        )


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
        SELECT CONCAT(first_name, ' ', last_name) AS employee_name, designation, branch, custom_region, custom_district, custom_zone,department, custom_division, cell_number
        FROM `tabEmployee`
        WHERE name=%s
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
           
            'employee_name': ['like', f"%{txt}%"]  # Search by name
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