# Copyright (c) 2026, Talib Sheikh
# For license information, please see license.txt

import frappe


def execute(filters=None):
    filters = filters or {}

    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    return [
        {"label": "Request No", "fieldname": "name", "fieldtype": "Link", "options": "CMS", "width": 200},
        {"label": "Transaction Category", "fieldname": "transaction_category", "fieldtype": "Select", "width": 130},
        {"label": "Requested Branch", "fieldname": "select_branch", "fieldtype": "Data", "width": 130},
        {"label": "Branch", "fieldname": "branch", "fieldtype": "Link", "options": "Branch", "width": 140},
        {"label": "Branch Name", "fieldname": "requested_branch", "fieldtype": "Link", "options": "Branch", "width": 140},
        {"label": "Transaction Type", "fieldname": "transaction_type", "fieldtype": "Select", "width": 130},
        {"label": "Date of Request", "fieldname": "date_of_request", "fieldtype": "Date", "width": 120},
        {"label": "Date of Transaction", "fieldname": "date_of_transaction", "fieldtype": "Date", "width": 120},
        {"label": "Amount", "fieldname": "amount", "fieldtype": "Currency", "width": 120},
        {"label": "Employee", "fieldname": "employee", "fieldtype": "Link", "options": "Employee", "width": 140},
        {"label": "Custodian 1", "fieldname": "custodian_1", "fieldtype": "Link", "options": "Employee", "width": 140},
        {"label": "Custodian 2", "fieldname": "custodian_2", "fieldtype": "Link", "options": "Employee", "width": 140},
        {"label": "Branch Distance KM", "fieldname": "branch_distance_km", "fieldtype": "Int", "width": 110},
        {"label": "Requested Movement Charges", "fieldname": "requested_movement_changes", "fieldtype": "Currency", "width": 140},
        {"label": "Approved Movement Charges", "fieldname": "approved_movement_charges", "fieldtype": "Currency", "width": 140},
        {"label": "Vehicle Type", "fieldname": "vehicle_type", "fieldtype": "Select", "width": 110},
        {"label": "Vehicle Number", "fieldname": "vehicle_number", "fieldtype": "Data", "width": 120},
        {"label": "Date & Time of Movement", "fieldname": "date_and_time_of_movement", "fieldtype": "Datetime", "width": 150},
        {"label": "Driver Name", "fieldname": "driver_name", "fieldtype": "Data", "width": 130},
        {"label": "Driver Contact Number", "fieldname": "driver_contact_number", "fieldtype": "Data", "width": 130},
        {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Small Text", "width": 160},
        {"label": "Acknowledged", "fieldname": "acknowledged", "fieldtype": "Check", "width": 100},
        {"label": "Transaction Receipt", "fieldname": "transaction_receipt", "fieldtype": "Data", "width": 150},
        {"label": "Attach Cheque/Documents", "fieldname": "attach_cheque", "fieldtype": "Data", "width": 150},
        {"label": "Status", "fieldname": "status", "fieldtype": "Select", "width": 110},
        {"label": "COM", "fieldname": "stage_1_emp_user", "fieldtype": "Data", "width": 130},
        {"label": "COM Status", "fieldname": "stage_1_emp_status", "fieldtype": "Select", "width": 110},
        {"label": "COM Remark", "fieldname": "stage_1_emp_remark", "fieldtype": "Small Text", "width": 150},
        {"label": "COM Email", "fieldname": "com_email", "fieldtype": "Data", "width": 150},
        {"label": "HO", "fieldname": "stage_2_emp_user", "fieldtype": "Data", "width": 130},
        {"label": "HO Status", "fieldname": "stage_2_emp_status", "fieldtype": "Select", "width": 110},
        {"label": "HO Remark", "fieldname": "stage_2_emp_remark", "fieldtype": "Small Text", "width": 150},
    ]


REPORT_FIELDS = [
    "name",
    "transaction_category",
    "select_branch",
    "branch",
    "requested_branch",
    "transaction_type",
    "date_of_request",
    "date_of_transaction",
    "amount",
    "employee",
    "custodian_1",
    "custodian_2",
    "branch_distance_km",
    "requested_movement_changes",
    "approved_movement_charges",
    "vehicle_type",
    "vehicle_number",
    "date_and_time_of_movement",
    "driver_name",
    "driver_contact_number",
    "remarks",
    "acknowledged",
    "transaction_receipt",
    "attach_cheque",
    "status",
    "stage_1_emp_user",
    "stage_1_emp_status",
    "stage_1_emp_remark",
    "com_email",
    "stage_2_emp_user",
    "stage_2_emp_status",
    "stage_2_emp_remark",
]


def get_data(filters):
    conditions = []
    values = {}

    # Date filter (mandatory)
    conditions.append("date_of_request BETWEEN %(from_date)s AND %(to_date)s")
    values.update({
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    })

    # Optional filters
    if filters.get("branch"):
        conditions.append("branch = %(branch)s")
        values["branch"] = filters.branch

    if filters.get("transaction_category"):
        conditions.append("transaction_category = %(transaction_category)s")
        values["transaction_category"] = filters.transaction_category

    if filters.get("transaction_type"):
        conditions.append("transaction_type = %(transaction_type)s")
        values["transaction_type"] = filters.transaction_type

    if filters.get("status"):
        conditions.append("status = %(status)s")
        values["status"] = filters.status

    condition_str = " AND ".join(conditions)

    fields = ",\n            ".join(REPORT_FIELDS)

    query = f"""
        SELECT
            {fields}
        FROM `tabCMS`
        WHERE {condition_str}
        ORDER BY modified DESC
    """

    return frappe.db.sql(query, values, as_dict=True)
