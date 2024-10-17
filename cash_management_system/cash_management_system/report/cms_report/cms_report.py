import frappe

def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    cms_data = get_cms_data()

    # Check if any data is found
    if not cms_data:
        frappe.msgprint("No Records Found")
        return columns, []

    # Prepare data in the required format
    data = []
    for d in cms_data:
        row = {
            "name": d.name,
            "transaction_category": d.transaction_category,
            "date_of_request": d.date_of_request,
            "requested_branch": capitalize_if_present(d.requested_branch),
            "transaction_type": capitalize_if_present(d.transaction_type),
            "amount": d.amount
        }
        data.append(row)

    return columns, data


def capitalize_if_present(s):
    """Capitalize the first letter of the string if present."""
    return s.capitalize() if s else ''


def get_columns():
    """Define the columns for the CMS report."""
    return [
        {"fieldname": "name", "label": "Request ID", "fieldtype": "Link", "options": "CMS", "width": "150"},
        {"fieldname": "transaction_category", "label": "Transaction Category", "fieldtype": "Data", "width": "150"},
        {"fieldname": "date_of_request", "label": "Date of Request", "fieldtype": "Date", "width": "100"},
        {"fieldname": "requested_branch", "label": "Requested Branch", "fieldtype": "Data", "width": "150"},
        {"fieldname": "transaction_type", "label": "Transaction Type", "fieldtype": "Data", "width": "100"},
        {"fieldname": "amount", "label": "Amount", "fieldtype": "Currency", "width": "100"}
    ]


def get_cms_data():
    """Fetch the data using raw SQL query."""
    query = """
        SELECT
            name,
            transaction_category,
            date_of_request,
            requested_branch,
            transaction_type,
            amount
        FROM
            `tabCMS`
        ORDER BY
            date_of_request DESC
    """

    try:
        return frappe.db.sql(query, as_dict=True)
    except Exception as e:
        frappe.log_error(f"Error fetching CMS data: {str(e)}")
        return []
