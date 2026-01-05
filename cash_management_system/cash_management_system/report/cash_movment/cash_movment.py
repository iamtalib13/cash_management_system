# Copyright (c) 2026, Talib Sheikh
# For license information, please see license.txt

import frappe
from frappe.utils import flt


def execute(filters=None):
    filters = filters or {}

    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    return [
        {
            "label": "Request No",
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "CMS",
            "width": 200
        },
        {
            "label": "Branch",
            "fieldname": "branch",
            "fieldtype": "Link",
            "options": "Branch",
            "width": 140
        },
        {
            "label": "Transaction Category",
            "fieldname": "transaction_category",
            "fieldtype": "Data",
            "width": 120
        },
        # {
        #     "label": "Transaction Type",
        #     "fieldname": "transaction_type",
        #     "fieldtype": "Data",
        #     "width": 120
        # },
        {
            "label": "Date of Request",
            "fieldname": "date_of_request",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Date of Transaction",
            "fieldname": "date_of_transaction",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Amount",
            "fieldname": "amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": "Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 100
        },
        {
            "label": "COM Status",
            "fieldname": "stage_1_emp_status",
            "fieldtype": "Data",
            "width": 110
        },
        {
            "label": "HO Status",
            "fieldname": "stage_2_emp_status",
            "fieldtype": "Data",
            "width": 110
        }
    ]


def get_data(filters):
    conditions = []
    values = {}

    # Date filter (mandatory)
    conditions.append("date_of_request BETWEEN %(from_date)s AND %(to_date)s")
    values.update({
        "from_date": filters.from_date,
        "to_date": filters.to_date
    })

    # Optional filters
    if filters.get("branch"):
        conditions.append("branch = %(branch)s")
        values["branch"] = filters.branch

    if filters.get("transaction_category"):
        conditions.append("transaction_category = %(transaction_category)s")
        values["transaction_category"] = filters.transaction_category

    # if filters.get("transaction_type"):
    #     conditions.append("transaction_type = %(transaction_type)s")
    #     values["transaction_type"] = filters.transaction_type

    if filters.get("status"):
        conditions.append("status = %(status)s")
        values["status"] = filters.status

    condition_str = " AND ".join(conditions)

    query = f"""
        SELECT
            name,
            branch,
            transaction_category,
            # transaction_type,
            date_of_request,
            date_of_transaction,
            amount,
            status,
            stage_1_emp_status,
            stage_2_emp_status
        FROM `tabCMS`
        WHERE {condition_str}
        ORDER BY modified DESC
    """

    return frappe.db.sql(query, values, as_dict=True)
