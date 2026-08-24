import frappe

def cms_permission_query(user):
    # -------------------------------------------------
    # 1. Administrator & HO Approver → full access
    # -------------------------------------------------
    ho_approver_ids = ["813@sahayog.com", "333@sahayog.com", "2800@sahayog.com"]
    if user in ["Administrator"] + ho_approver_ids:
        return ""

    # -------------------------------------------------
    # 2. Fetch Employee details
    # -------------------------------------------------
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["custom_zone", "designation", "branch"],
        as_dict=True
    )

    if not employee:
        return "1 = 0"

    user_zone = employee.custom_zone
    user_branch = employee.branch
    designation = (employee.designation or "").upper()

    # -------------------------------------------------
    # 3. COM / Region-level roles
    # -------------------------------------------------
    region_designations = {
        "CLUSTER OPERATION MANAGER",
        "REGIONAL OPERATION MANAGER",
        "ASST. ZONAL MANAGER",
        "ZONAL MANAGER",
        "SR. CLUSTER OPERATION MANAGER",
        "SR.CLUSTER OPERATION MANAGER",
        "SR. ZONAL MANAGER"
    }

    # If the user's designation is in the list, they act as a COM/Regional approver
    has_region_access = any(d in designation for d in region_designations)

    # -------------------------------------------------
    # 4. Build conditions dynamically
    # -------------------------------------------------
    conditions = []

    # Requester Designations
    requester_designations = {
        "ASST. BRANCH MANAGER",
        "BRANCH OFFICER",
        "BRANCH MANAGER",
        "BRANCH OPERATION MANAGER",
        "BRANCH CHANNEL MANAGER",
        "CUSTOMER SERVICE OFFICER",
        "CUSTOMER SERVICE MANAGER",
    }

    # Own records (If designation is in requester or region list)
    is_requester_by_desig = any(d in designation for d in requester_designations)

    if is_requester_by_desig or has_region_access:
        conditions.append(f"`tabCMS`.owner = '{user}'")

    # Assigned Approver access (COM or HO)
    conditions.append(f"`tabCMS`.stage_1_emp_user = '{user}'")
    conditions.append(f"`tabCMS`.stage_2_emp_user = '{user}'")

    # Requester: Also show records where requested_branch matches employee's branch
    if is_requester_by_desig and user_branch:
        conditions.append(f"""
            (`tabCMS`.requested_branch = '{user_branch}' 
             AND `tabCMS`.transaction_category = 'CIT')
        """)

    # Region records (COM / ZM / ROM)
    if has_region_access:
        conditions.append(f"""
            EXISTS (
                SELECT 1
                FROM `tabEmployee` e
                WHERE
                    e.user_id = `tabCMS`.owner
                    AND e.custom_zone = '{user_zone}'
            )
        """)
        
    # Special rule: CIT + Gondia HO access for Creator, COM, and HO
    # The current HO approver logic at the start of the function covers HO Approvers already.
    # We need to add logic for Creator and COM for these specific records.
    conditions.append(f"""
        (`tabCMS`.transaction_category = 'CIT' 
         AND `tabCMS`.requested_branch = 'Gondia HO'
         AND (`tabCMS`.owner = '{user}' OR {str(has_region_access).lower()}))
    """)

    # -------------------------------------------------
    # 7. Apply OR logic
    # -------------------------------------------------
    if conditions:
        return "(" + " OR ".join(conditions) + ")"

    # -------------------------------------------------
    # 8. Default → no access
    # -------------------------------------------------
    return "1 = 0"
