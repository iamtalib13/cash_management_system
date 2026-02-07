frappe.listview_settings["CMS"] = {
  hide_name_column: true,
  refresh: function (listview) {
    // Hide the layout side section (if needed)
    $(".layout-side-section").hide();

    // Hide the primary buttons in the list view
    // $(".primary-action").hide();

    // Check if the user is not a System Manager
    //   if (!frappe.user.has_role("System Manager")) {
    //     // Redirect to /policies if the user is not a System Manager
    //     window.location.href = "/policies#cms";
    //   }
  },
  onload(listview) {
    const user = frappe.session.user;

    // ✅ Bypass for Administrator
    if (user === "Administrator") {
      return;
    }

    frappe.db
      .get_value("Employee", { user_id: user }, "designation")
      .then((r) => {
        if (!r.message) {
          listview.$page.empty().html(`
            <div style="padding:40px;text-align:center;color:#888;">
              You are not authorized to view this page.
            </div>
          `);
          return;
        }

        // Normalize designation (UPPERCASE + trim)
        const designation = (r.message.designation || "").trim().toUpperCase();

        const allowed = [
          "BRANCH MANAGER",
          "BRANCH OPERATION MANAGER",
          "BRANCH OFFICER",
          "REGIONAL OPERATION MANAGER",
          "BRANCH OFFICER",
          "Branch Operation Manager",
          "Customer Service Officer",
          "Customer Service Manager",
          "CLUSTER OPERATION MANAGER",
          "Regional Operation Manager",
          "ASST. ZONAL MANAGER",
          "ZONAL MANAGER",
        ];

        // ❌ Not allowed → blank page
        if (!allowed.includes(designation)) {
          listview.$page.empty().html(`
            <div style="padding:40px;text-align:center;color:#888;">
              You are not authorized to view this page.
            </div>
          `);
        }
      });
  },
};
