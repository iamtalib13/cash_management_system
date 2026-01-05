import frappe
import json

@frappe.whitelist(allow_guest=True)  # This allows the method to be called from the front-end
def get_cms_records(status=None):

    user = frappe.session.user

    # --------------------------------------------------
    # 1. Extract employee id safely (TEMP FIX)
    # --------------------------------------------------
    emp_id = None
    if "@" in user:
        emp_id = user.split("@")[0]

    # DEBUG (DO NOT SKIP)
    frappe.log_error(
        f"user={user}, trimmed_emp_id={emp_id}",
        "CMS VISIBILITY DEBUG"
    )

    # --------------------------------------------------
    # 2. Get CMS User role
    # --------------------------------------------------
    cms_user = frappe.db.get_value(
        "CMS User",
        user,
        ["requester", "com_approver", "ho_approver"],
        as_dict=True
    )

    if not cms_user:
        return []

    # --------------------------------------------------
    # 3. Parse status
    # --------------------------------------------------
    statuses = []
    if status:
        try:
            statuses = json.loads(status)
        except Exception:
            pass

    filters = {}
    if statuses:
        filters["status"] = ["in", statuses]

    # --------------------------------------------------
    # 4. OR filters (THIS IS CRITICAL)
    # --------------------------------------------------
    or_filters = []

    # Requester
    if cms_user.requester == 1:
        or_filters.append(["CMS", "owner", "=", user])

    # COM Approver
    if cms_user.com_approver == 1 and emp_id:
        or_filters.append(["CMS", "stage_1_emp_user", "=", emp_id])

    # HO Approver
    if cms_user.ho_approver == 1 and emp_id:
        or_filters.append(["CMS", "stage_2_emp_user", "=", emp_id])

    if not or_filters:
        return []

    # --------------------------------------------------
    # 5. Fetch records
    # --------------------------------------------------
    records = frappe.get_all(
        "CMS",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "name",
            "status",
            "branch",
            "owner",
            "stage_1_emp_user",
            "stage_1_emp_status",
            "stage_2_emp_user",
            "stage_2_emp_status",
            "modified"
        ],
        order_by="modified desc"
    )

    # DEBUG
    frappe.log_error(
        f"records_found={len(records)}",
        "CMS VISIBILITY RESULT"
    )

    return records

def ho_records(status):
    user = frappe.session.user  # Get the current session user
    frappe.msgprint(f"HO user is: {user}")

    # Initialize status_to_pass
    status_to_pass = None

    # Check if status is a JSON string
    if isinstance(status, str):
        try:
            # Parse JSON string to a list
            status = json.loads(status)
        except json.JSONDecodeError:
            frappe.msgprint("Invalid status format. Using default.")

    # Check if status is a list
    if isinstance(status, list) and status:
        # Extract the first element from the list
        status_to_pass = status[0]
    elif isinstance(status, str):
        # If status is a string, assign it directly
        status_to_pass = status

    # Log the status passed
    frappe.msgprint(f"HO status pass: {status_to_pass}")

    sql = frappe.db.sql(
        """SELECT cms.* 
        FROM `tabCMS` AS cms
        WHERE cms.stage_2_emp_user = %s
        AND cms.stage_2_emp_status = %s
        order by modified DESC;""",
        (user,status_to_pass),  # Only pass the user, as the status is now constant
        as_dict=True,
    )
    return sql


def com_records(status):
    user = frappe.session.user  # Get the current session user
    frappe.msgprint(f"HO user is: {user}")

    # Initialize status_to_pass
    status_to_pass = None

    # Check if status is a JSON string
    if isinstance(status, str):
        try:
            # Parse JSON string to a list
            status = json.loads(status)
        except json.JSONDecodeError:
            frappe.msgprint("Invalid status format. Using default.")

   
    # Check if status is a list
    if isinstance(status, list) and status:
        # Extract the first element from the list
        status_to_pass = status[0]
    elif isinstance(status, str):
        # If status is a string, assign it directly
        status_to_pass = status

    # Log the status passed
    frappe.msgprint(f"COM status pass: {status_to_pass}")

    sql = frappe.db.sql(
        """SELECT cms.* 
        FROM `tabCMS` AS cms
        WHERE cms.stage_1_emp_user = %s
        AND cms.stage_1_emp_status = %s
        order by modified DESC;""",
        (user,status_to_pass),  # Only pass the user, as the status is now constant
        as_dict=True,
    )
    return sql
