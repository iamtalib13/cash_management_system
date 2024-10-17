import frappe
import json

@frappe.whitelist(allow_guest=True)  # This allows the method to be called from the front-end
def get_cms_records(status=None):
    user = frappe.session.user
    
    try:
        # Display the current user for debugging purposes
        frappe.msgprint(f"Current user is: {user}")
        
        # Fetch user permissions
        user_permission = frappe.db.get_value(
            'CMS User',
            user,
            ['user', 'requester', 'ho_approver', 'com_approver', 'reports'],
            as_dict=True  # Ensure the result is a dictionary
        )
        
        if user_permission:
            user_type = None
            if user_permission.requester == 1:
                user_type = "Requester"
            elif user_permission.ho_approver == 1:
                 user_type = "HO_Approver"
                 return {"message": ho_records(status)}  # Return the records directly
                    
            elif user_permission.com_approver == 1:
                user_type = "COM_Approver"
                return {"message": com_records(status)}  # Return the records directly
            
            # Display a message based on user type
            if user_type:
                frappe.msgprint(f"User type is: {user_type}")

            # Convert status from JSON string to Python list if needed
            if status:
                statuses = json.loads(status)
            else:
                statuses = []

            # Define filters based on the statuses list
            filters = {}
            if statuses:
                filters['status'] = ['in', statuses]

            # Apply user type specific filters
            if user_type == "Requester":
                filters['owner'] = user
            elif user_type == "COM_Approver":
                filters['stage_1_emp_user'] = user
                #filters['stage_1_emp_status']='Pending'
            
            # Fetch CMS records with the given filters
            cms_records = frappe.db.get_all(
                'CMS',
                filters=filters,
                fields=['name', 'status', 'owner','branch', 'stage_1_emp_user','stage_1_emp_status', 'stage_2_emp_status', 'creation', 'modified'],
                order_by='creation desc'
            )
            
            # Return the data as JSON
            return {"message": cms_records}
        else:
            raise ValueError("User permissions not found.")
    
    except Exception as e:
        # Log the error and show a message
        frappe.log_error(message=str(e), title="Error in get_cms_records")
        frappe.msgprint(f"An error occurred while fetching records: {str(e)}")
        return {"message": "Error occurred while fetching records."}

import json

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
