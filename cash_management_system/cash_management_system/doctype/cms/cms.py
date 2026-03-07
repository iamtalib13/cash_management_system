# Copyright (c) 2024, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import nowdate
from frappe.utils.pdf import get_pdf  # Import get_pdf directly
from frappe.utils import now_datetime
from frappe.utils import escape_html
import frappe
from frappe.utils import date_diff, nowdate
from frappe.utils import now_datetime, get_url_to_form
import frappe
from frappe.utils import now_datetime
import frappe
from frappe.utils import get_url_to_form
import frappe
from frappe.utils import get_url_to_form, escape_html
from frappe.utils import nowdate, add_days, getdate

class CMS(Document):
    def check_cheque_details(self, mandatory=False):
            # Loop through each row in the cheque_details child table
            for row in self.cheque_details:
                # 1. Mandatory check for Amount (always required)
                if not row.cheque_amount:
                    frappe.throw(f"Row #{row.idx}: 'Amount' is required.")
                
                # 2. Mandatory check for Cheque Number (Only if mandatory=True)
                if mandatory and not row.cheque_number:
                    frappe.throw(f"Row #{row.idx}: 'Cheque Number' is mandatory for this transaction.")

                # 3. Numeric validation (Runs if a value is provided, regardless of category)
                if row.cheque_number and not str(row.cheque_number).isdigit():
                    frappe.throw(f"Row #{row.idx}: 'Cheque Number' must contain only digits.")

    def validate(self):
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
           self.check_cheque_details(mandatory=False)

        if self.transaction_category == "WITHDRAWAL":
           self.check_cheque_details(mandatory=True)      
        
        if self.transaction_category == "DEPOSIT":
           self.check_cheque_details(mandatory=False)         

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
        # else:
            # frappe.msgprint(f"No email found for user: {self.com_email}")
        # Convert fields to uppercase if they exist
        # if self.ifsc_code:
        #     self.ifsc_code = self.ifsc_code.upper()
        # if self.account_number:
        #     self.account_number = self.account_number.upper()
        # if self.cheque_number:
        #     self.cheque_number = self.cheque_number.upper()

        # Set the stage_1_emp_user field using the get_com method
         
    def check_transaction_date(self):
        # Get the previous status if it exists
        old_status = self._doc_before_save.status if self._doc_before_save else None

        # Only check if date is in the past during initial submission (Draft -> Pending)
        # or while still in Draft. Skip for all other approval stages.
        is_initial_submission = (self.status == "Pending" and (not old_status or old_status == "Draft"))
        
        if self.status == "Draft" or is_initial_submission:
            # Today's date
            current_date = getdate(nowdate())

            # Convert transaction date to date object
            transaction_date = getdate(self.date_of_transaction)

            # 1. Date should not be in the past
            if transaction_date < current_date:
                frappe.throw(
                    _("Transaction date cannot be in the past. Please select today or a future date.")
                )

        # The 5-day future limit should still apply to everyone to prevent extreme future dates
        current_date = getdate(nowdate())
        transaction_date = getdate(self.date_of_transaction)
        max_allowed_date = add_days(current_date, 5)

        if transaction_date > max_allowed_date:
            frappe.throw(
                _("Transaction date cannot be more than 5 days from today.")
            )

    def get_com(self, branch):
    
        # Fetch the 'employee' field from the 'COM Mapping' doctype based on the branch
        com = frappe.db.get_value('COM Mapping', branch, 'employee')
        
        # If com is found, concatenate it with '@sahayog.com'
        if com:
            return f"{com}@sahayog.com"
        
        # If com is not found, return None
        return None
    # --------------------------------------------------
    # EMAIL TRIGGERS every tine the request change the status (SAFE & RELIABLE)
    # --------------------------------------------------
    def on_update(self):
        old = self._doc_before_save
        if not old:
            return

        # COM approval / rejection / pending
        if old.stage_1_emp_status != self.stage_1_emp_status:
            if self.stage_1_emp_status == "Approved":
                send_status_email(self, "Approved by COM", self.stage_1_emp_remark)
            elif self.stage_1_emp_status == "Rejected":
                send_status_email(self, "Rejected by COM", self.stage_1_emp_remark)
            elif self.stage_1_emp_status == "Pending":
                send_status_email(self, "Pending for COM Approval")

        # HO approval / rejection / pending
        if old.stage_2_emp_status != self.stage_2_emp_status:
            if self.stage_2_emp_status == "Approved":
                send_status_email(self, "Approved by Head Office", self.stage_2_emp_remark)
            elif self.stage_2_emp_status == "Rejected":
                send_status_email(self, "Rejected by Head Office", self.stage_2_emp_remark)
            elif self.stage_2_emp_status == "Pending":
                send_status_email(self, "Pending for Head Office Approval")

# --------------------------------------------------
# EMAIL FUNCTION - SEND STATUS UPDATE EMAIL
# --------------------------------------------------
def send_status_email(doc, action, remark=None):
    # --------------------------------------------------
    # 1. OWNER & BRANCH EMAIL LOGIC
    # --------------------------------------------------
    owner = doc.owner
    recipients = set()
    
    # Fetch Employee details (company_email and sol_id)
    emp_details = frappe.db.get_value(
        "Employee", 
        {"user_id": owner}, 
        ["company_email", "sol_id"],
        as_dict=True
    )
    
    if emp_details:
        # Add company email if available
        if emp_details.get("company_email"):
            recipients.add(emp_details.get("company_email").strip().lower())
        
        # Add branch email based on sol_id
        if emp_details.get("sol_id"):
            branch_email = frappe.db.get_value(
                "Sahayog Branch", 
                str(emp_details.get("sol_id")), 
                "email"
            )
            if branch_email:
                recipients.add(branch_email.strip().lower())

    # Fallback: if no email found yet, use owner (user_id)
    if not recipients:
        recipients.add(owner)

    # Log for debugging
    frappe.log_error(
        f"CMS Email Recipients - Owner: {owner}, Recipients: {list(recipients)}",
        "CMS Email Debug"
    )

    # --------------------------------------------------
    # 2. COM APPROVER LOGIC (Designation-based in same Region)
    # --------------------------------------------------
    if emp_details and emp_details.get("custom_region"):
        # COM Designations to search for
        com_designations = [
            "CLUSTER OPERATION MANAGER",
            "REGIONAL OPERATION MANAGER",
            "ASST. ZONAL MANAGER",
            "ZONAL MANAGER"
        ]
        
        # Find an active Employee in the same region with a COM designation
        com_approver_emails = frappe.db.get_all(
            "Employee",
            filters={
                "custom_region": emp_details.get("custom_region"),
                "status": "Active",
                "designation": ["in", com_designations]
            },
            fields=["company_email"]
        )

        found_com_email = False
        for emp in com_approver_emails:
            if emp.get("company_email"):
                recipients.add(emp.get("company_email").strip().lower())
                found_com_email = True
        
        if not found_com_email:
            # Fallback to Branch Email if no COM designation match found in region
            if emp_details.get("sol_id"):
                branch_email = frappe.db.get_value("Sahayog Branch", str(emp_details.get("sol_id")), "email")
                if branch_email:
                    recipients.add(branch_email.strip().lower())

    # --------------------------------------------------
    # 3. HO APPROVER LOGIC (User 813)
    # --------------------------------------------------
    ho_user_ids = ["813@sahayog.com", "333@sahayog.com","2800@sahayog.com"]
    for ho_user in ho_user_ids:
        ho_company_email = frappe.db.get_value("Employee", {"user_id": ho_user}, "company_email")
        if ho_company_email:
            recipients.add(ho_company_email.strip().lower())
        else:
            recipients.add(ho_user)

    # --------------------------------------------------
    # 4. RECORD URL
    # --------------------------------------------------
    record_url = get_url_to_form(doc.doctype, doc.name)

    # --------------------------------------------------
    # 6. APPROVAL PROGRESS UI
    # --------------------------------------------------
    def step(label, status):
        color = {
            "Approved": "#16a34a",
            "Rejected": "#dc2626", 
            "Pending": "#f59e0b"
        }.get(status, "#9ca3af")

        return f"""
        <div style="flex:1;text-align:center;">
            <div style="font-size:12px;color:#374151;margin-bottom:8px;">
                {label}<br><b>{status}</b>
            </div>
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
                font-weight:bold;
            ">
                ✓
            </div>
        </div>
        """

    stage_1 = doc.stage_1_emp_status or "Pending"
    stage_2 = doc.stage_2_emp_status or "Pending"
    final_status = doc.status or "Pending"

    # --------------------------------------------------
    # 7. SUBJECT
    # --------------------------------------------------
    subject = f"CMS Request {doc.name} – {action}"

    # --------------------------------------------------
    # 8. EMAIL HTML - FIXED ESCAPING
    # --------------------------------------------------
    safe_action = frappe.utils.escape_html(action or "")
    safe_remark = frappe.utils.escape_html(remark or "")
    
    message = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:20px;">
      <div style="max-width:650px;margin:auto;background:white;
                  border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,.08);">

        <div style="background:#0f766e;padding:18px;color:white;
                    text-align:center;font-size:18px;font-weight:bold;">
          Cash Management System
        </div>

        <div style="padding:22px;color:#111827;">
          <p>Hello,</p>

          <p>
            Your CMS request <b>{doc.name}</b> has been
            <b style="color:#0f766e;">{safe_action}</b>.
          </p>

          {f'''
          <div style="background:#fef3c7;border-left:5px solid #f59e0b;
                      padding:12px;margin:16px 0;">
            <b>Remarks:</b><br>{safe_remark}
          </div>
          ''' if remark else ""}
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

          <div style="text-align:center;margin:28px 0;">
            <a href="{record_url}" target="_blank"
               style="background:#0f766e;color:white;
                      padding:12px 22px;border-radius:6px;
                      text-decoration:none;font-weight:bold;">
              Open CMS Request
            </a>
          </div>

          <p style="font-size:13px;color:#6b7280;">
            Please login to the system for more details.
          </p>
        </div>

        <div style="background:#f9fafb;padding:14px;text-align:center;
                    font-size:12px;color:#6b7280;">
          This is an automated notification.<br>
          Cash Management System
        </div>
      </div>
    </div>
    """

    # --------------------------------------------------
    # 9. SEND EMAIL TO ALL (CREATOR FIRST + COM + HO)
    # --------------------------------------------------
    # try:
    frappe.sendmail(
            recipients=list(recipients),
            subject=subject,
            message=message,
            now=True
     )
        # frappe.msgprint(f"Status email sent to: {', '.join(recipients)}")
    # except Exception as e:
    #     # frappe.log_error(f"Email send failed: {str(e)}\nRecipients: {recipients}", "CMS Email Send Error")

# send the pending approval reminders
def get_pending_cms_requests():
    """
    Returns a list of dicts with pending CMS info.
    Does NOT send email.
    """

    results = []

    cms_docs = frappe.get_all(
        "CMS",
        filters={"status": "Pending"},
        fields=[
            "name",
            "transaction_category",
            "stage_1_emp_status",
            "stage_2_emp_status",
            "modified",
        ],
    )

    # Resolve COM & HO users
    com_user = frappe.db.get_value("CMS User", {"status": "COM-Approver"}, "name")
    ho_user = frappe.db.get_value("CMS User", {"status": "HO-Approver"}, "name")

    com_email = frappe.db.get_value(
        "Employee", {"user_id": com_user}, "company_email"
    ) if com_user else None

    ho_email = frappe.db.get_value(
        "Employee", {"user_id": ho_user}, "company_email"
    ) if ho_user else None

    now = now_datetime()

    for doc in cms_docs:
        delta = now - doc.modified
        days = delta.days
        hours = delta.seconds // 3600
        pending_text = f"{days}d {hours}h"

        # COM pending
        if doc.stage_1_emp_status == "Pending" and com_email:
            row = {
                "cms_name": doc.name,
                "transaction_category": doc.transaction_category,
                "level": "COM",
                "email": com_email,
                "pending": pending_text,
            }
            results.append(row)

        # HO pending
        elif (
            doc.stage_1_emp_status == "Approved"
            and doc.stage_2_emp_status == "Pending"
            and ho_email
        ):
            row = {
                "cms_name": doc.name,
                "transaction_category": doc.transaction_category,
                "level": "HO",
                "email": ho_email,
                "pending": pending_text,
            }
            results.append(row)

    # 🔍 DEBUG OUTPUT
    frappe.logger().info(f"CMS Pending Payload → {results}")
    print("\n=== CMS PENDING REQUESTS ===")
    for r in results:
        print(r)

    return results

def send_pending_approval_emails():
    pending_items = get_pending_cms_requests()

    if not pending_items:
        frappe.logger().info("CMS Reminder: No pending approvals")
        return

    # ---------------------------------------------
    # FORCE TWO BUCKETS ONLY (COM / HO)
    # ---------------------------------------------
    grouped = {
        "COM": {"email": None, "requests": []},
        "HO":  {"email": None, "requests": []},
    }

    for item in pending_items:
        level = item["level"]
        grouped[level]["email"] = item["email"]
        grouped[level]["requests"].append(item)

    # ---------------------------------------------
    # SEND MAX TWO EMAILS
    # ---------------------------------------------
    for level, data in grouped.items():
        email = data["email"]
        requests = data["requests"]

        if not email or not requests:
            continue

        # ---------------- TABLE ROWS ----------------
        rows_html = ""
        for idx, r in enumerate(requests, start=1):
            url = get_url_to_form("CMS", r["cms_name"])
            rows_html += f"""
            <tr>
                <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">{idx}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">
                    <a href="{url}" target="_blank"
                       style="color:#2563eb;font-weight:600;text-decoration:none;">
                        {r["cms_name"]}
                    </a>
                </td>
                <td style="padding:8px;border:1px solid #e5e7eb;">
                    {r["transaction_category"]}
                </td>
                <td style="padding:8px;border:1px solid #e5e7eb;">
                    {r["pending"]}
                </td>
            </tr>
            """

        # ---------------- SUBJECT ----------------
        subject = f"CMS Pending {level} Approvals ({len(requests)})"

        # ---------------- EMAIL BODY (CARD UI) ----------------
        message = f"""
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px;font-family:Arial,Helvetica,sans-serif;">
            <tr>
                <td align="center">

                <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">
                    
                    <!-- HEADER -->
                    <tr>
                    <td style="background:#0f766e;color:#ffffff;padding:14px;text-align:center;font-size:18px;font-weight:bold;">
                        Cash Management System
                    </td>
                    </tr>

                    <!-- BODY -->
                    <tr>
                    <td style="padding:20px;color:#111827;font-size:14px;">

                        <p>Hello,</p>

                        <p>
                        You have <b>{len(requests)}</b> CMS request(s)
                        pending for <b>{level} approval</b>.
                        </p>

                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-top:15px;">
                        <thead>
                            <tr style="background:#f9fafb;">
                            <th style="border:1px solid #e5e7eb;padding:8px;">Sr No</th>
                            <th style="border:1px solid #e5e7eb;padding:8px;">Request ID</th>
                            <th style="border:1px solid #e5e7eb;padding:8px;">Transaction</th>
                            <th style="border:1px solid #e5e7eb;padding:8px;">Pending Since</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows_html}
                        </tbody>
                        </table>

                        <p style="margin-top:18px;font-size:13px;color:#6b7280;">
                        Please review the above request(s) at the earliest.
                        </p>

                    </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                    <td style="background:#f9fafb;padding:12px;text-align:center;font-size:12px;color:#6b7280;">
                        This is an automated notification.<br>
                        Cash Management System
                    </td>
                    </tr>

                </table>

                </td>
            </tr>
            </table>
            """


        # ---------------- SEND ----------------
        frappe.sendmail(
            recipients=[email],
            subject=subject,
            message=message,
            now=True
        )

        frappe.logger().info(
            f"CMS Pending Summary Sent | {level} | {email} | {len(requests)}"
        )

import frappe
from frappe.utils import now_datetime



@frappe.whitelist()
def send_cit_ack(cms_name):
    # ---------------------------------
    # 0. Load CMS document
    # ---------------------------------
    doc = frappe.get_doc("CMS", cms_name)

    # ---------------------------------
    # 1. Mandatory validations
    # ---------------------------------
    if doc.transaction_category != "CIT":
        frappe.throw(
            "CIT acknowledgement is allowed only for CIT transactions."
        )

    if doc.stage_2_emp_status != "Approved":
        frappe.throw(
            "CIT acknowledgement is allowed only after final approval."
        )

    if doc.get("acknowledged"):
        frappe.throw(
            "CIT cash has already been acknowledged."
        )

    if not doc.requested_branch:
        frappe.throw(
            "Requested Branch is mandatory."
        )

    # ---------------------------------
    # 2. Get COM Approver users
    # ---------------------------------
    com_users = frappe.get_all(
        "CMS User",
        filters={"com_approver": 1},
        fields=["user"]
    )

    if not com_users:
        frappe.throw(
            "No COM Approver configured in CMS User."
        )

    com_user_ids = [u.user for u in com_users if u.user]

    # ---------------------------------
    # 3. Get Employees
    #    (Requested Branch + COM Approver)
    # ---------------------------------
    employees = frappe.get_all(
        "Employee",
        filters={
            "user_id": ["in", com_user_ids],
            "branch": doc.requested_branch,
            "status": "Active"
        },
        fields=["name", "employee_name", "company_email"]
    )

    if not employees:
        frappe.throw(
            f"No COM Approver employee found for branch {doc.requested_branch}."
        )

    # ---------------------------------
    # 4. Collect email recipients
    # ---------------------------------
    recipients = list(
        {
            emp.company_email.strip().lower()
            for emp in employees
            if emp.company_email
        }
    )

    recipient_names = list(
        {
            emp.employee_name or emp.name
            for emp in employees
            if emp.company_email
        }
    )

    if not recipients:
        frappe.throw(
            f"COM Approver found for branch {doc.requested_branch}, "
            "but company email is not configured."
        )

    # ---------------------------------
    # 5. Update ACK details
    # ---------------------------------
    # Save first so `modified` becomes ACK time
    doc.acknowledged = 1
    doc.cit_ack_by = frappe.session.user
    doc.save(ignore_permissions=True)

    ack_time = doc.modified  # ✅ use record modified time
    employee_name = frappe.db.get_value(
    "Employee",
    {"user_id": frappe.session.user},
    "employee_name"
) or frappe.session.user
    record_url = get_url_to_form(doc.doctype, doc.name)

    # ---------------------------------
    # 6. Send ACK email
    # ---------------------------------
    frappe.sendmail(
        recipients=recipients,
        subject=f"CIT Cash Reached – {doc.name}",
        message=f"""
    <div style="
        max-width:600px;
        margin:0 auto;
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:8px;
        font-family:Arial, Helvetica, sans-serif;
        color:#1f2937;
        box-shadow:0 1px 3px rgba(0,0,0,0.05);
    ">

        <!-- Header -->
        <div style="
            background:linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
            color:#ffffff;
            padding:16px 20px;
            font-size:18px;
            font-weight:bold;
            border-radius:8px 8px 0 0;
            text-align:center;
            letter-spacing:0.5px;
        ">
            ✅ CIT Cash Acknowledgement
        </div>

        <!-- Body -->
        <div style="padding:20px; font-size:14px; line-height:1.6;">

            <div style="
                background:#f0fdfa;
                border:1px solid #ccfbf1;
                border-radius:6px;
                padding:12px 16px;
                margin-bottom:20px;
                text-align:center;
            ">
                <p style="margin:0; font-size:15px; font-weight:600; color:#0f766e;">
                    The CIT cash has been <span style="color:#059669;">successfully received</span>
                </p>
            </div>

            <div style="
                background:#f9fafb;
                border-radius:6px;
                padding:16px;
                margin-bottom:20px;
            ">
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="padding:8px 0; width:40%; font-weight:600; color:#4b5563;">CMS No:</td>
                    <td style="padding:8px 0;">
                        <a href="{record_url}" 
                           target="_blank"
                           style="
                               color:#0f766e;
                               font-weight:600;
                               text-decoration:none;
                               background:#ecfdf5;
                               padding:4px 12px;
                               border-radius:4px;
                               border:1px solid #a7f3d0;
                               display:inline-block;
                           "
                           onmouseover="this.style.backgroundColor='#d1fae5'; this.style.textDecoration='underline';"
                           onmouseout="this.style.backgroundColor='#ecfdf5'; this.style.textDecoration='none';">
                            {doc.name}
                        </a>
                    </td>
                </tr>
                    <tr>
                        <td style="padding:8px 0; font-weight:600; color:#4b5563;">Requested Branch:</td>
                        <td style="padding:8px 0;">{doc.requested_branch}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; font-weight:600; color:#4b5563;">Amount:</td>
                        <td style="padding:8px 0; color:#dc2626; font-weight:600; font-size:15px;">₹ {doc.amount}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; font-weight:600; color:#4b5563;">Acknowledged On:</td>
                        <td style="padding:8px 0;">{ack_time}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; font-weight:600; color:#4b5563;">Acknowledged By:</td>{employee_name}
                        <td style="padding:8px 0; color:#0f766e;">({frappe.session.user})</td>
                    </tr>
                </table>
            </div>

            <div style="
                background:#fef3c7;
                border-left:4px solid #f59e0b;
                padding:12px 16px;
                margin-top:16px;
                font-size:13px;
                color:#92400e;
                border-radius:0 4px 4px 0;
            ">
                <strong>Note:</strong> Please verify the cash received matches the amount mentioned above.
            </div>

        </div>

        <!-- Footer -->
        <div style="
            background:#f9fafb;
            padding:14px 20px;
            font-size:12px;
            color:#6b7280;
            border-top:1px solid #e5e7eb;
            border-radius:0 0 8px 8px;
            text-align:center;
        ">
            <p style="margin:0 0 4px 0;">
               Please do not reply to this email
            </p>
        </div>

    </div>
    """,
        delayed=False
    )



    # ---------------------------------
    # 7. Return response for UI
    # ---------------------------------
    return {
        "status": "success",
        "recipients": recipients,
        "recipient_names": recipient_names,
        "ack_time": ack_time
    }


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
        SELECT CONCAT(first_name, ' ', last_name) AS employee_name, designation, branch, custom_region, custom_district, custom_zone,department, custom_division, cell_number,sol_id
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
    