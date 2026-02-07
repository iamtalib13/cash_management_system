import frappe

def cms_permission_query(user):
    # -------------------------------------------------
    # 1. Administrator → full access
    # -------------------------------------------------
    if user == "Administrator":
        return ""

    # -------------------------------------------------
    # 2. CMS User flags
    # -------------------------------------------------
    cms_user = frappe.db.get_value(
        "CMS User",
        {"user": user},
        ["requester", "com_approver", "ho_approver"],
        as_dict=True
    ) or {}

    is_requester = cms_user.get("requester", 0)
    is_com_approver = cms_user.get("com_approver", 0)
    is_ho_approver = cms_user.get("ho_approver", 0)

    # -------------------------------------------------
    # 3. HO Approver → all records
    # -------------------------------------------------
    if is_ho_approver:
        return ""

    # -------------------------------------------------
    # 4. Fetch Employee details
    # -------------------------------------------------
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["custom_region", "designation"],
        as_dict=True
    )

    if not employee:
        return "1 = 0"

    user_region = employee.custom_region
    designation = (employee.designation or "").upper()

    # -------------------------------------------------
    # 5. Region-level roles SHOW THE RECORDS WHERE REGION MATCHES
    # -------------------------------------------------
    region_designations = {
        "ZONAL MANAGER",
        "REGIONAL OPERATION MANAGER"
    }

    has_region_access = is_com_approver or designation in region_designations

    # -------------------------------------------------
    # 6. Build conditions dynamically
    # -------------------------------------------------
    conditions = []

    # Own records (Requester)
    if is_requester:
        conditions.append(f"`tabCMS`.owner = '{user}'")

    # Region records (COM / ZM / ROM)
    if has_region_access:
        conditions.append(f"""
            EXISTS (
                SELECT 1
                FROM `tabEmployee` e
                WHERE
                    e.user_id = `tabCMS`.owner
                    AND e.custom_region = '{user_region}'
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
