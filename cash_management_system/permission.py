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
        ["custom_zone", "designation"],
        as_dict=True
    )

    if not employee:
        return "1 = 0"

    user_zone = employee.custom_zone
    designation = (employee.designation or "").upper()

    # -------------------------------------------------
    # 3. COM / Region-level roles
    # -------------------------------------------------
    region_designations = {
        "CLUSTER OPERATION MANAGER",
        "REGIONAL OPERATION MANAGER",
        "ASST. ZONAL MANAGER",
        "ZONAL MANAGER"
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
        "CUSTOMER SERVICE OFFICER",
        "CUSTOMER SERVICE MANAGER",
    }

    # Own records (If designation is in requester or region list)
    is_requester_by_desig = any(d in designation for d in requester_designations)
    
    if is_requester_by_desig or has_region_access:
        conditions.append(f"`tabCMS`.owner = '{user}'")

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

    # -------------------------------------------------
    # 7. Apply OR logic
    # -------------------------------------------------
    if conditions:
        return "(" + " OR ".join(conditions) + ")"

    # -------------------------------------------------
    # 8. Default → no access
    # -------------------------------------------------
    return "1 = 0"
