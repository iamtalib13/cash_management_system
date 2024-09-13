frappe.listview_settings["CMS"] = {
  hide_name_column: true,
  refresh: function (listview) {
    $(".layout-side-section").hide();
  },
  // onload(listview) {
  //   if (frappe.user_roles.includes("Store Manager")) {
  //     // Additional logic for Store Manager role
  //   } else {
  //     // Logic for other roles
  //   }
  // },
  // set_row_background: function (row) {
  //   // Custom background colors based on entry_type
  //   if (row.entry_type == "STOCK-IN") {
  //     return "success"; // Green background
  //   } else if (row.entry_type == "STOCK-OUT") {
  //     return "danger"; // Red background
  //   }
  // },
  // get_indicator: function (doc) {
  //   if (doc.entry_type == "STOCK-IN") {
  //     return [__("STOCK-IN"), "green", "entry_type,=,STOCK-IN"];
  //   } else if (doc.entry_type == "STOCK-OUT") {
  //     return [__("STOCK-OUT"), "red", "entry_type,=,STOCK-OUT"];
  //   }
  // },
  // formatters: {
  //   // Custom formatters can be added here if needed
  // },
};
