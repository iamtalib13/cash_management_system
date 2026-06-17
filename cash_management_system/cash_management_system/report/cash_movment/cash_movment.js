// Copyright (c) 2026, Talib Sheikh
// For license information, please see license.txt

frappe.query_reports["Cash Movment"] = {
  filters: [
    {
      fieldname: "from_date",
      label: __("From Date"),
      fieldtype: "Date",
      reqd: 1,
      default: frappe.datetime.month_start(),
    },
    {
      fieldname: "to_date",
      label: __("To Date"),
      fieldtype: "Date",
      reqd: 1,
      default: frappe.datetime.month_end(),
    },
    {
      fieldname: "branch",
      label: __("Branch"),
      fieldtype: "Link",
      options: "Branch",
    },
    {
      fieldname: "transaction_category",
      label: __("Transaction Category"),
      fieldtype: "Select",
      options: "\nDEPOSIT\nWITHDRAWAL\nCIT",
    },
    // {
    //   fieldname: "transaction_type",
    //   label: __("Transaction Type"),
    //   fieldtype: "Select",
    //   options: "\nCASH\nACCOUNT TRANSFER",
    // },
    {
      fieldname: "status",
      label: __("Status"),
      fieldtype: "Select",
      options: "\nDraft\nCOM Pending\nHO Pending\nApproved\nRejected\nCompleted",
    },
  ],
};
