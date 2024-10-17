frappe.listview_settings["CMS"] = {
  hide_name_column: true,
  refresh: function (listview) {
    // Hide the layout side section (if needed)
    $(".layout-side-section").hide();

    // Hide the primary buttons in the list view
    $(".primary-action").hide();

    // Check if the user is not a System Manager
    if (!frappe.user.has_role("System Manager")) {
      // Redirect to /policies if the user is not a System Manager
      window.location.href = "/policies#cms";
    }
  },
};
