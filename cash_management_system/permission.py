import frappe

def cms_permission_query(user):
    # ----------------------------------------
    # 1. Administrator → all records
    # ----------------------------------------
    if user == "Administrator":
        return ""

    # ----------------------------------------
    # 2. CMS User flags
    # ----------------------------------------
    cms_user = frappe.db.get_value(
        "CMS User",
        {"user": user},
        ["requester", "com_approver", "ho_approver"],
        as_dict=True
    )

    is_requester = cms_user.requester if cms_user else 0
    is_com_approver = cms_user.com_approver if cms_user else 0
    is_ho_approver = cms_user.ho_approver if cms_user else 0

    # ----------------------------------------
    # 3. HO Approver → all records
    # ----------------------------------------
    if is_ho_approver:
        return ""

    # ----------------------------------------
    # 4. Requester → own records only
    # ----------------------------------------
    if is_requester:
        return f"`tabCMS`.owner = '{user}'"

    # ----------------------------------------
    # 5. Get Employee details
    # ----------------------------------------
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

    # ----------------------------------------
    # 6. Region-level access roles
    # ----------------------------------------
    allowed_designations = {
        "ZONAL MANAGER",
        "REGIONAL OPERATION MANAGER"
    }

    # ----------------------------------------
    # 7. COM / ZM / ROM → region-based access
    # ----------------------------------------
    if is_com_approver or designation in allowed_designations:
        return f"""
            EXISTS (
                SELECT 1
                FROM `tabEmployee` e
                WHERE
                    e.name = `tabCMS`.employee
                    AND e.custom_region = '{user_region}'
            )
        """

    # ----------------------------------------
    # 8. Default → no access
    # ----------------------------------------
    return "1 = 0"
